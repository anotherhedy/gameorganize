import { supabase } from './supabaseClient';
import { GameData, GameSubmission } from '../../types';

const SUPABASE_DIRECT = 'https://dbgekqlyliksvipakmpg.supabase.co';
export const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// ========== 智能选路 ==========

let _apiBase: string | null = null;
let _probePromise: Promise<string> | null = null;  // 防并发重复探测

/** 探测直连 Supabase 是否可达，返回最优 base URL */
export async function detectApiBase(): Promise<string> {
  if (_apiBase) return _apiBase;

  // 尝试 localStorage 缓存（有效期 30 分钟）
  const cached = localStorage.getItem('sea_api_mode');
  if (cached) {
    try {
      const { mode, ts } = JSON.parse(cached);
      if (Date.now() - ts < 30 * 60 * 1000) {
        _apiBase = mode === 'direct' ? SUPABASE_DIRECT : '/api';
        console.log('[选路] 使用缓存:', mode === 'direct' ? '直连 Supabase' : 'CF 代理');
        return _apiBase;
      }
    } catch { /* ignore */ }
  }

  // 已有探测进行中，复用结果
  if (_probePromise) return _probePromise;

  // 快速探测直连（1.5 秒超时）
  console.log('[选路] 探测直连...');
  _probePromise = (async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1500);
      const resp = await fetch(`${SUPABASE_DIRECT}/rest/v1/games?select=id&limit=1`, {
        headers: { apikey: ANON_KEY },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (resp.ok) {
        _apiBase = SUPABASE_DIRECT;
        localStorage.setItem('sea_api_mode', JSON.stringify({ mode: 'direct', ts: Date.now() }));
        console.log('[选路] 直连可达 → 直连 Supabase');
        return _apiBase;
      }
    } catch {
      // 超时或失败 → 走代理
    }

    _apiBase = '/api';
    localStorage.setItem('sea_api_mode', JSON.stringify({ mode: 'proxy', ts: Date.now() }));
    console.log('[选路] 直连不可达 → CF 代理');
    return _apiBase;
  })();

  try {
    return await _probePromise;
  } finally {
    _probePromise = null;
  }
}

/** 清除选路缓存（网络环境变化时调用） */
export function clearApiBaseCache() {
  _apiBase = null;
  localStorage.removeItem('sea_api_mode');
}

// ========== 共享 ==========

const BASE_SELECT = 'id, title, url, description, image_url, category, tags, created_at, author_name, author_url, answer_text, answer_url';

function mapGameRow(dbGame: any): GameData {
  return {
    id: dbGame.id.toString(),
    title: dbGame.title,
    url: dbGame.url,
    releaseDate: dbGame.created_at ? dbGame.created_at.split('T')[0] : '未知',
    description: dbGame.description,
    author: { text: dbGame.author_name || '研究员', url: dbGame.author_url || '' },
    platform: {
      pc: dbGame.tags?.includes('PC') || false,
      pe: dbGame.tags?.includes('PE') || false,
    },
    tags: {
      hasJumpScare: dbGame.tags?.includes('有跳杀') || false,
      hasSound: dbGame.tags?.includes('有声音') || false,
    },
    duration: dbGame.category?.[0] || '',
    answer: { text: dbGame.answer_text || '', url: dbGame.answer_url || '' },
    coverImage: dbGame.image_url,
  };
}

// ========== 底层 fetch（全部走这个） ==========

let cachedToken: string | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const { data } = await supabase.auth.getSession();
  cachedToken = data.session?.access_token || '';
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedToken = session?.access_token || '';
  });
  return cachedToken;
}

async function apiHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    apikey: ANON_KEY,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  // 有 token 才带 Authorization，空 token 发出去会被 PostgREST 拒绝（PGRST301）
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function apiFetch<T>(
  path: string,
  opts: {
    method?: string;
    params?: URLSearchParams;
    body?: any;
    timeout?: number;
    extraHeaders?: Record<string, string>;
    rawResponse?: boolean; // 返回原始 Response
  } = {}
): Promise<T> {
  const { method = 'GET', params, body, timeout = 15000, extraHeaders = {}, rawResponse } = opts;

  const base = await detectApiBase();
  const url = `${base}${path}${params ? '?' + params : ''}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const headers = { ...(await apiHeaders()), ...extraHeaders };
    const resp = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (rawResponse) return resp as T;

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      throw new Error(`[${resp.status}] ${errBody || resp.statusText}`);
    }

    if (resp.status === 204 || resp.status === 201 || method === 'HEAD') {
      const text = await resp.text().catch(() => '');
      if (!text) return undefined as T;
      return JSON.parse(text) as T;
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

// ========== Games ==========

export async function fetchAllGames(): Promise<GameData[]> {
  const params = new URLSearchParams({ select: BASE_SELECT, order: 'id.asc' });
  const data = await apiFetch<any[]>('/rest/v1/games', { params, timeout: 12000 });
  return (data || []).map(mapGameRow);
}

export async function incrementGameViews(gameId: string) {
  try {
    await apiFetch('/rest/v1/rpc/increment_game_views', {
      method: 'POST',
      body: { target_id: gameId },
      timeout: 8000,
    });
  } catch (err) {
    console.error('Error incrementing views:', err);
  }
}

export async function fetchGameStats(): Promise<Record<string, number>> {
  const params = new URLSearchParams({ select: 'game_id,views' });
  const data = await apiFetch<any[]>('/rest/v1/game_stats', { params, timeout: 10000 });
  const stats: Record<string, number> = {};
  if (data) data.forEach((row: any) => { stats[row.game_id.toString()] = row.views; });
  return stats;
}

// ========== 投稿审核 ==========

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

export interface CheckDuplicateResult {
  isDuplicate: boolean;
  existingTitle?: string;
  checkFailed: boolean;
}

/** 检查游戏名是否已存在。excludeSubId: 编辑时排除自己的投稿 ID */
export async function checkDuplicateGame(title: string, excludeSubId?: number): Promise<CheckDuplicateResult> {
  try {
    const gamesResult = await apiFetch<any[]>('/rest/v1/games', {
      params: new URLSearchParams({ select: 'id,title', title: `eq.${title}`, limit: '1' }),
      timeout: 8000,
    });
    if (gamesResult?.length > 0) return { isDuplicate: true, existingTitle: gamesResult[0].title, checkFailed: false };

    const params = new URLSearchParams({ select: 'id,title', title: `eq.${title}`, status: 'neq.已驳回', limit: '5' });
    const subResult = await apiFetch<any[]>('/rest/v1/game_submissions', { params, timeout: 8000 });
    // 排除自己（编辑时标题未改的情况）
    const filtered = excludeSubId ? (subResult || []).filter((s: any) => s.id !== excludeSubId) : (subResult || []);
    if (filtered.length > 0) return { isDuplicate: true, existingTitle: filtered[0].title, checkFailed: false };

    return { isDuplicate: false, checkFailed: false };
  } catch (err: any) {
    console.warn('checkDuplicateGame 异常:', err?.message);
    return { isDuplicate: true, checkFailed: true };
  }
}

export async function submitGameForReview(payload: GameSubmitPayload & { submitted_by: string }) {
  await apiFetch('/rest/v1/game_submissions', {
    method: 'POST',
    body: {
      title: payload.title, url: payload.url, description: payload.description,
      image_url: payload.image_url || null, duration: payload.duration,
      author_name: payload.author_name, author_url: payload.author_url,
      answer_url: payload.answer_url || null, pc: payload.pc, pe: payload.pe,
      jumpscare: payload.jumpscare, sound: payload.sound, submitted_by: payload.submitted_by,
    },
    timeout: 15000,
  });
}

/** 管理员直接提交 → games 表（无需审核） */
export async function adminDirectSubmit(payload: GameSubmitPayload) {
  // 获取安全 ID
  const maxResult = await apiFetch<any[]>('/rest/v1/games', {
    params: new URLSearchParams({ select: 'id', order: 'id.desc', limit: '1' }),
    timeout: 8000,
  });
  let nextId = 1;
  if (maxResult?.length > 0) {
    const parsed = parseInt(String(maxResult[0].id), 10);
    if (!isNaN(parsed)) nextId = parsed + 1;
  }

  // 直接插入 games
  await apiFetch('/rest/v1/games', {
    method: 'POST',
    body: {
      id: nextId,
      title: payload.title, url: payload.url, description: payload.description,
      image_url: payload.image_url || null,
      category: [payload.duration].filter(Boolean),
      author_name: payload.author_name, author_url: payload.author_url,
      answer_url: payload.answer_url || null, answer_text: '',
      tags: [payload.pc ? 'PC' : null, payload.pe ? 'PE' : null,
        payload.jumpscare ? '有跳杀' : null, payload.sound ? '有声音' : null].filter(Boolean),
    },
    timeout: 15000,
  });
}

export async function fetchPendingSubmissions(): Promise<GameSubmission[]> {
  const params = new URLSearchParams({ select: '*', status: 'eq.审核中', order: 'created_at.desc' });
  return (await apiFetch<any[]>('/rest/v1/game_submissions', { params, timeout: 10000 })) || [];
}

export async function fetchPendingCount(): Promise<number> {
  // PostgREST count 需要 Prefer: count=exact header
  const params = new URLSearchParams({ select: 'id', status: 'eq.审核中', limit: '1' });
  const resp = await apiFetch<Response>('/rest/v1/game_submissions', {
    params,
    timeout: 10000,
    extraHeaders: { Prefer: 'count=exact' },
    rawResponse: true,
  });
  const range = resp.headers.get('content-range');
  if (range) {
    const match = range.match(/(\d+)$/);
    if (match) return parseInt(match[1], 10);
  }
  return 0;
}

export async function approveSubmission(submissionId: number) {
  await apiFetch('/rest/v1/rpc/approve_submission', {
    method: 'POST', body: { sub_id: submissionId }, timeout: 20000,
  });
}

export async function rejectSubmission(submissionId: number, reason: string) {
  await apiFetch('/rest/v1/rpc/reject_submission', {
    method: 'POST', body: { sub_id: submissionId, reason }, timeout: 20000,
  });
}

export async function fetchMySubmissions(userId: string): Promise<GameSubmission[]> {
  const params = new URLSearchParams({ select: '*', submitted_by: `eq.${userId}`, order: 'created_at.desc' });
  return (await apiFetch<any[]>('/rest/v1/game_submissions', { params, timeout: 10000 })) || [];
}

/** 重新提交投稿：更新内容 + 重置状态为审核中 */
export async function resubmitSubmission(subId: number, payload: GameSubmitPayload) {
  await apiFetch(`/rest/v1/game_submissions?id=eq.${subId}`, {
    method: 'PATCH',
    body: {
      title: payload.title, url: payload.url, description: payload.description,
      image_url: payload.image_url || null, duration: payload.duration,
      author_name: payload.author_name, author_url: payload.author_url,
      answer_url: payload.answer_url || null, pc: payload.pc, pe: payload.pe,
      jumpscare: payload.jumpscare, sound: payload.sound,
      status: '审核中', review_comment: null,
    },
    timeout: 15000,
  });
}

// ========== Profiles ==========

export async function fetchProfile(userId: string): Promise<any | null> {
  const params = new URLSearchParams({ select: '*', id: `eq.${userId}`, limit: '1' });
  const data = await apiFetch<any[]>('/rest/v1/profiles', { params, timeout: 10000 });
  return data?.[0] || null;
}

export async function updateSolvedGames(userId: string, solvedGameIds: string[]): Promise<void> {
  await apiFetch(`/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    body: { solved_game_ids: solvedGameIds },
    timeout: 10000,
    extraHeaders: { Prefer: 'return=minimal' },
  });
}

export interface ProfileUpsert {
  id: string;
  username: string;
  xhs_id?: string | null;
  role?: string;
  updated_at?: string;
}

export async function upsertProfile(data: ProfileUpsert): Promise<any | null> {
  const result = await apiFetch<any[]>('/rest/v1/profiles', {
    method: 'POST',
    body: data,
    timeout: 10000,
    extraHeaders: {
      Prefer: 'resolution=merge-duplicates, return=representation',
    },
  });
  return result?.[0] || null;
}

// ========== Games 管理 ==========

export async function deleteGame(gameId: string): Promise<void> {
  await apiFetch(`/rest/v1/games?id=eq.${gameId}`, {
    method: 'DELETE',
    timeout: 10000,
  });
}

export async function updateGame(gameId: string, payload: Record<string, any>): Promise<void> {
  await apiFetch(`/rest/v1/games?id=eq.${gameId}`, {
    method: 'PATCH',
    body: payload,
    timeout: 10000,
    extraHeaders: { Prefer: 'return=minimal' },
  });
}

// ========== Feedback（情报墙） ==========

export async function fetchFeedbacks(page: number, pageSize: number): Promise<{ data: any[]; count: number }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const params = new URLSearchParams({
    select: '*',
    order: 'created_at.desc',
    offset: String(from),
    limit: String(pageSize),
  });
  const resp = await apiFetch<Response>('/rest/v1/feedback', {
    params,
    timeout: 10000,
    extraHeaders: { Prefer: 'count=exact' },
    rawResponse: true,
  });
  const data = await resp.json();
  const rangeHeader = resp.headers.get('content-range');
  let count = 0;
  if (rangeHeader) {
    const parts = rangeHeader.split('/');
    if (parts.length === 2) count = parseInt(parts[1], 10) || 0;
  }
  return { data, count };
}

export async function insertFeedback(data: {
  detective_name: string;
  intel_content: string;
  user_id: string | null;
}): Promise<void> {
  await apiFetch('/rest/v1/feedback', {
    method: 'POST',
    body: data,
    timeout: 10000,
  });
}

export async function updateFeedback(id: number, data: Record<string, any>): Promise<void> {
  await apiFetch(`/rest/v1/feedback?id=eq.${id}`, {
    method: 'PATCH',
    body: data,
    timeout: 10000,
    extraHeaders: { Prefer: 'return=minimal' },
  });
}

export async function deleteFeedback(id: number): Promise<void> {
  await apiFetch(`/rest/v1/feedback?id=eq.${id}`, {
    method: 'DELETE',
    timeout: 10000,
  });
}
