import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 移除对 dotenv 的依赖，直接从环境变量或文件读取
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 尝试从 .env 文件手动解析变量 (如果 process.env 中没有)
function getEnv(key) {
  if (process.env[key]) return process.env[key];
  try {
    const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    const match = envContent.match(new RegExp(`${key}=(.*)`));
    return match ? match[1].trim() : null;
  } catch (e) {
    return null;
  }
}

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseKey = getEnv('VITE_SERVICE_KEY') || getEnv('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
  console.error('错误: 环境变量 VITE_SUPABASE_URL 未设置，或找不到 VITE_SERVICE_KEY / VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

if (getEnv('VITE_SERVICE_KEY')) {
  console.log('🚀 检测到 Service Key，正在以管理员权限同步...');
} else {
  console.log('⚠️ 未检测到 Service Key，将尝试使用 Anon Key 同步 (可能会触发 RLS 限制)...');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncGames() {
  try {
    const jsonPath = path.join(__dirname, 'public/data/games.json');
    if (!fs.existsSync(jsonPath)) {
      console.error('错误: 找不到 games.json 文件:', jsonPath);
      return;
    }

    const gamesJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`正在读取 JSON 数据，共 ${gamesJson.length} 条...`);

    // 格式化数据以匹配数据库结构
    const formattedGames = gamesJson.map(game => {
      // 尝试解析 ID，如果不是数字则保持原样（取决于数据库列类型）
      // 假设你的数据库 id 列是 integer，如果不是，请移除 parseInt
      const numericId = parseInt(game.id);
      const finalId = isNaN(numericId) ? game.id : numericId;

      return {
        id: finalId,
        title: game.title,
        url: game.url,
        description: game.description,
        image_url: game.coverImage || '',
        category: [game.duration].filter(Boolean),
        tags: [
          game.platform?.pc ? 'PC' : null,
          game.platform?.pe ? 'PE' : null,
          game.tags?.hasJumpScare ? '有跳杀' : null,
          game.tags?.hasSound ? '有声音' : null
        ].filter(Boolean),
        created_at: game.releaseDate || new Date().toISOString(),
        author_name: game.author?.text || '研究员',
        author_url: game.author?.url || '',
        answer_text: game.answer?.text || '',
        answer_url: game.answer?.url || '',
        status: game.status || '是'
      };
    });

    console.log('正在同步到 Supabase...');

    // 使用 upsert 批量更新或插入
    const { data, error } = await supabase
      .from('games')
      .upsert(formattedGames, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      });

    if (error) {
      throw error;
    }

    console.log('✅ 同步成功！数据库已更新。');
  } catch (err) {
    console.error('❌ 同步失败:', err.message);
  }
}

syncGames();
