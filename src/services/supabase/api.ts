import { supabase } from './supabaseClient';
import { GameData } from '../../types';

export async function fetchAllGames(): Promise<GameData[]> {
  const { data, error } = await supabase
    .from('games')
    .select('id, title, url, created_at, description, tags, category, image_url')
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching games:', error);
    return [];
  }

  // 将数据库字段映射回前端使用的 GameData 结构
  return (data || []).map((dbGame: any) => ({
    id: dbGame.id.toString(),
    title: dbGame.title,
    url: dbGame.url,
    releaseDate: dbGame.created_at, // 或者你数据库里存的发布日期字段
    status: '是', // 数据库里的默认为活跃
    description: dbGame.description,
    author: { text: '', url: '' }, // 后续 CMS 完善后可存储作者信息
    platform: {
      pc: dbGame.tags?.includes('PC') || false,
      pe: dbGame.tags?.includes('PE') || false
    },
    tags: {
      hasJumpScare: dbGame.tags?.includes('有跳杀') || false,
      hasSound: dbGame.tags?.includes('有声音') || false
    },
    duration: dbGame.category?.[0] || '',
    answer: { text: '', url: '' },
    coverImage: dbGame.image_url
  }));
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
