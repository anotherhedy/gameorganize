import { supabase } from './supabaseClient';

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
      stats[row.game_id] = row.views;
    });
  }
  return stats;
}
