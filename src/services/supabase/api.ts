import { supabase } from './supabaseClient';
import { GameData, GameSubmission } from '../../types';

const BASE_SELECT = 'id, title, url, description, image_url, category, tags, created_at, author_name, author_url, answer_text, answer_url';

function mapGameRow(dbGame: any): GameData {
  return {
    id: dbGame.id.toString(),
    title: dbGame.title,
    url: dbGame.url,
    releaseDate: dbGame.created_at ? dbGame.created_at.split('T')[0] : '未知',
    description: dbGame.description,
    author: {
      text: dbGame.author_name || '研究员',
      url: dbGame.author_url || ''
    },
    platform: {
      pc: dbGame.tags?.includes('PC') || false,
      pe: dbGame.tags?.includes('PE') || false
    },
    tags: {
      hasJumpScare: dbGame.tags?.includes('有跳杀') || false,
      hasSound: dbGame.tags?.includes('有声音') || false
    },
    duration: dbGame.category?.[0] || '',
    answer: {
      text: dbGame.answer_text || '',
      url: dbGame.answer_url || ''
    },
    coverImage: dbGame.image_url,
  };
}

// ========== 底层 fetch（绕过 supabase-js 的超时问题） ==========

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

let cachedToken: string | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const { data } = await supabase.auth.getSession();
  cachedToken = data.session?.access_token || '';
  // 监听 token 刷新
  supabase.auth.onAuthStateChange((event, session) => {
    cachedToken = session?.access_token || '';
  });
  return cachedToken;
}

function apiUrl(path: string, params?: URLSearchParams): string {
  const base = `${window.location.origin}/api`;
  const url = `${base}${path}`;
  return params ? `${url}?${params}` : url;
}

async function apiHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

async function apiFetch<T>(
  path: string,
  opts: { method?: string; params?: URLSearchParams; body?: any; timeout?: number } = {}
): Promise<T> {
  const { method = 'GET', params, body, timeout = 15000 } = opts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const resp = await fetch(apiUrl(path, params), {
      method,
      headers: await apiHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      throw new Error(`[${resp.status}] ${errBody || resp.statusText}`);
    }

    // 204 No Content / HEAD
    if (resp.status === 204 || method === 'HEAD') {
      return undefined as T;
    }

    return resp.json();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`请求超时(${timeout}ms): ${path}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ========== Games (已通过的游戏) ==========

export async function fetchAllGames(): Promise<GameData[]> {
  const { data, error } = await supabase
    .from('games')
    .select(BASE_SELECT)
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching games:', error);
    return [];
  }

  return (data || []).map(mapGameRow);
}

export async function incrementGameViews(gameId: string) {
  const { error } = await supabase.rpc('increment_game_views', { target_id: gameId });
  if (error) {
    console.error('Error incrementing views:', error);
  }
}

export async function fetchGameStats() {
  const { data, error } = await supabase
    .from('game_stats')
    .select('game_id, views');

  if (error) {
    console.error('Error fetching game stats:', error);
    return {};
  }

  const stats: Record<string, number> = {};
  if (data) {
    data.forEach((row: any) => {
      stats[row.game_id.toString()] = row.views;
    });
  }
  return stats;
}

// ========== 投稿审核（game_submissions 表） ==========

export interface GameSubmitPayload {
  title: string;
  url: string;
  image_url: string;
  description: string;
  duration: string;
  author_name: string;
  author_url: string;
  answer_url: string;
  pc: boolean;
  pe: boolean;
  jumpscare: boolean;
  sound: boolean;
}

/** 检查游戏名是否已存在（查 games + game_submissions 两张表） */
export async function checkDuplicateGame(title: string): Promise<{ isDuplicate: boolean; existingTitle?: string }> {
  console.log('[api] checkDuplicateGame:', title);
  try {
    // 查 games 表
    const gamesParams = new URLSearchParams({
      select: 'id,title',
      title: `eq.${title}`,
      limit: '1',
    });
    const gamesResult = await apiFetch<any[]>('/rest/v1/games', {
      params: gamesParams,
      timeout: 8000,
    });

    if (gamesResult && gamesResult.length > 0) {
      return { isDuplicate: true, existingTitle: gamesResult[0].title };
    }

    // 查 game_submissions（排除已驳回）
    const subParams = new URLSearchParams({
      select: 'id,title',
      title: `eq.${title}`,
      status: 'neq.已驳回',
      limit: '1',
    });
    const subResult = await apiFetch<any[]>('/rest/v1/game_submissions', {
      params: subParams,
      timeout: 8000,
    });

    if (subResult && subResult.length > 0) {
      return { isDuplicate: true, existingTitle: subResult[0].title };
    }

    return { isDuplicate: false };
  } catch (err: any) {
    console.warn('checkDuplicateGame 异常:', err?.message);
    return { isDuplicate: false };
  }
}

/** 提交新游戏投稿 → game_submissions 表 */
export async function submitGameForReview(payload: GameSubmitPayload & { submitted_by: string }) {
  console.log('[api] submitGameForReview');
  await apiFetch('/rest/v1/game_submissions', {
    method: 'POST',
    body: {
      title: payload.title,
      url: payload.url,
      description: payload.description,
      image_url: payload.image_url || null,
      duration: payload.duration,
      author_name: payload.author_name,
      author_url: payload.author_url,
      answer_url: payload.answer_url || null,
      pc: payload.pc,
      pe: payload.pe,
      jumpscare: payload.jumpscare,
      sound: payload.sound,
      submitted_by: payload.submitted_by,
    },
    timeout: 15000,
  });
}

/** 获取待审核投稿 */
export async function fetchPendingSubmissions(): Promise<GameSubmission[]> {
  const params = new URLSearchParams({
    select: '*',
    status: 'eq.审核中',
    order: 'created_at.desc',
  });
  const data = await apiFetch<any[]>('/rest/v1/game_submissions', { params, timeout: 10000 });
  return (data || []) as GameSubmission[];
}

/** 待审核数量 */
export async function fetchPendingCount(): Promise<number> {
  const params = new URLSearchParams({
    select: 'id',
    status: 'eq.审核中',
    limit: '0',
  });

  // 需要 count header，用 supabase 方式
  const { count, error } = await supabase
    .from('game_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('status', '审核中');

  if (error) {
    console.error('Error fetching pending count:', error);
    return 0;
  }

  return count || 0;
}

/** 管理员通过投稿（调用 RPC，原子操作：插 games + 改 submission） */
export async function approveSubmission(submissionId: number) {
  const { error } = await supabase.rpc('approve_submission', { sub_id: submissionId });
  if (error) throw error;
}

/** 管理员驳回投稿 */
export async function rejectSubmission(submissionId: number, reason: string) {
  const { error } = await supabase.rpc('reject_submission', { sub_id: submissionId, reason });
  if (error) throw error;
}

/** 获取我的投稿 */
export async function fetchMySubmissions(userId: string): Promise<GameSubmission[]> {
  const params = new URLSearchParams({
    select: '*',
    submitted_by: `eq.${userId}`,
    order: 'created_at.desc',
  });
  const data = await apiFetch<any[]>('/rest/v1/game_submissions', { params, timeout: 10000 });
  return (data || []) as GameSubmission[];
}
