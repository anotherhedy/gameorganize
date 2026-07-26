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

/** Promise/thenable 超时包装 */
function withTimeout<T>(thenable: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    thenable,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[${label}] 超时(${ms}ms)`)), ms)
    )
  ]);
}

/** 检查游戏名是否已存在（查 games + game_submissions 两张表） */
export async function checkDuplicateGame(title: string): Promise<{ isDuplicate: boolean; existingTitle?: string }> {
  try {
    // 先查已上架的 games
    const { data: gamesData, error: gamesError } = await withTimeout(
      supabase.from('games').select('id, title').eq('title', title).limit(1),
      6000,
      'checkDuplicate-games'
    );

    if (gamesError) {
      console.warn('checkDuplicateGame games 查询失败:', gamesError.message);
    } else if (gamesData && gamesData.length > 0) {
      return { isDuplicate: true, existingTitle: gamesData[0].title };
    }

    // 再查投稿表（排除已驳回的，避免重复投稿卡住）
    const { data: subData, error: subError } = await withTimeout(
      supabase.from('game_submissions').select('id, title').eq('title', title).neq('status', '已驳回').limit(1),
      6000,
      'checkDuplicate-submissions'
    );

    if (subError) {
      console.warn('checkDuplicateGame submissions 查询失败:', subError.message);
    } else if (subData && subData.length > 0) {
      return { isDuplicate: true, existingTitle: subData[0].title };
    }

    return { isDuplicate: false };
  } catch (err: any) {
    console.warn('checkDuplicateGame 异常:', err?.message);
    return { isDuplicate: false };
  }
}

/** 提交新游戏投稿 → game_submissions 表 */
export async function submitGameForReview(payload: GameSubmitPayload & { submitted_by: string }) {
  const { error } = await withTimeout(
    supabase.from('game_submissions').insert({
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
    }),
    10000,
    'submitGame-insert'
  );

  if (error) throw error;
}

/** 获取待审核投稿 */
export async function fetchPendingSubmissions(): Promise<GameSubmission[]> {
  const { data, error } = await supabase
    .from('game_submissions')
    .select('*')
    .eq('status', '审核中')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending submissions:', error);
    return [];
  }

  return (data || []) as GameSubmission[];
}

/** 待审核数量 */
export async function fetchPendingCount(): Promise<number> {
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
  const { data, error } = await supabase
    .from('game_submissions')
    .select('*')
    .eq('submitted_by', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('fetchMySubmissions failed:', error.message);
    return [];
  }

  return (data || []) as GameSubmission[];
}
