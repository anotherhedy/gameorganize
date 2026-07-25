import { supabase } from './supabaseClient';
import { GameData } from '../../types';

const BASE_SELECT = 'id, title, url, description, image_url, category, tags, created_at, author_name, author_url, answer_text, answer_url, status, review_comment';
const FULL_SELECT = `${BASE_SELECT}, submitted_by`;

// 共享的字段映射逻辑
function mapGameRow(dbGame: any): GameData {
  return {
    id: dbGame.id.toString(),
    title: dbGame.title,
    url: dbGame.url,
    releaseDate: dbGame.created_at ? dbGame.created_at.split('T')[0] : '未知',
    status: dbGame.status || '是',
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
    submitted_by: dbGame.submitted_by || undefined,
    review_comment: dbGame.review_comment || undefined
  };
}

export async function fetchAllGames(): Promise<GameData[]> {
  // 优先查 submitted_by，列不存在则降级
  let { data, error } = await supabase
    .from('games')
    .select(FULL_SELECT)
    .order('id', { ascending: true });

  if (error) {
    console.warn('fetchAllGames with submitted_by failed, retrying:', error.message);
    const retry = await supabase
      .from('games')
      .select(BASE_SELECT)
      .order('id', { ascending: true });
    if (retry.error) {
      console.error('Error fetching games:', retry.error);
      return [];
    }
    data = retry.data as any;
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
      // 显式转为字符串，确保与 GameData.id 类型匹配
      stats[row.game_id.toString()] = row.views;
    });
  }
  return stats;
}

// ========== 社区投稿 + 审核 ==========

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

/** 给 Promise/thenable 加超时，国内网络 Supabase 可能无响应挂住 */
function withTimeout<T>(thenable: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    thenable,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[${label}] 超时(${ms}ms)`)), ms)
    )
  ]);
}

/** 检查游戏名称或链接是否已存在 */
export async function checkDuplicateGame(title: string, url: string): Promise<{ isDuplicate: boolean; existingTitle?: string }> {
  try {
    // 一次查询同时检查标题和链接，6 秒超时（国内网络可能很慢）
    const { data, error } = await withTimeout(
      supabase
        .from('games')
        .select('id, title')
        .or(`title.eq.${JSON.stringify(title)},url.eq.${JSON.stringify(url)}`)
        .limit(1),
      6000,
      'checkDuplicateGame'
    );

    if (error) {
      console.warn('checkDuplicateGame 查询失败:', error.message);
      return { isDuplicate: false }; // 容错：查不了就不拦截
    }

    if (data && data.length > 0) {
      return { isDuplicate: true, existingTitle: data[0].title };
    }

    return { isDuplicate: false };
  } catch (err: any) {
    console.warn('checkDuplicateGame 异常:', err?.message);
    return { isDuplicate: false }; // 容错：超时也放行
  }
}

export async function submitGameForReview(payload: GameSubmitPayload & { submitted_by: string }) {
  // 获取安全的自增 ID（兼容手动录入的整数 ID），8 秒超时
  const { data: maxRow } = await withTimeout(
    supabase
      .from('games')
      .select('id')
      .order('id', { ascending: false })
      .limit(1),
    8000,
    'submitGame-getMaxId'
  );

  let nextId = 1;
  if (maxRow && maxRow.length > 0) {
    const parsed = parseInt(String(maxRow[0].id), 10);
    if (!isNaN(parsed)) nextId = parsed + 1;
  }

  // 插入，10 秒超时
  const { error } = await withTimeout(
    supabase
      .from('games')
      .insert({
      id: nextId,
      title: payload.title,
      url: payload.url,
      image_url: payload.image_url,
      description: payload.description,
      category: [payload.duration].filter(Boolean),
      author_name: payload.author_name,
      author_url: payload.author_url,
      answer_url: payload.answer_url || null,
      tags: [
        payload.pc ? 'PC' : null,
        payload.pe ? 'PE' : null,
        payload.jumpscare ? '有跳杀' : null,
        payload.sound ? '有声音' : null
      ].filter(Boolean),
      status: '审核中',
      submitted_by: payload.submitted_by
    }),
    10000,
    'submitGame-insert'
  );

  if (error) throw error;
}

export async function fetchPendingGames(): Promise<GameData[]> {
  let { data, error } = await supabase
    .from('games')
    .select(FULL_SELECT)
    .eq('status', '审核中')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('fetchPendingGames with submitted_by failed, retrying:', error.message);
    const retry = await supabase
      .from('games')
      .select(BASE_SELECT)
      .eq('status', '审核中')
      .order('created_at', { ascending: false });
    if (retry.error) {
      console.error('Error fetching pending games:', retry.error);
      return [];
    }
    data = retry.data as any;
  }

  return (data || []).map(mapGameRow);
}

export async function fetchPendingCount(): Promise<number> {
  const { count, error } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('status', '审核中');

  if (error) {
    console.error('Error fetching pending count:', error);
    return 0;
  }

  return count || 0;
}

export async function updateGameStatus(gameId: string, status: string, comment?: string) {
  const payload: Record<string, any> = { status };
  if (comment) payload.review_comment = comment;
  else if (status === '是') payload.review_comment = null; // 通过时清掉旧原因

  const { error } = await supabase
    .from('games')
    .update(payload)
    .eq('id', gameId);

  if (error) throw error;
}

export async function fetchMySubmissions(userId: string): Promise<GameData[]> {
  let { data, error } = await supabase
    .from('games')
    .select(FULL_SELECT)
    .eq('submitted_by', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('fetchMySubmissions failed:', error.message);
    return [];
  }

  return (data || []).map(mapGameRow);
}
