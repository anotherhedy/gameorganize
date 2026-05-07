import { supabase } from './supabaseClient';
import { GameData } from '../../types';

export async function fetchAllGames(): Promise<GameData[]> {
  const { data, error } = await supabase
    .from('games')
    .select('id, title, url, description, image_url, category, tags, created_at, author_name, author_url, answer_text, answer_url, status')
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
