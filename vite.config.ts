import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'https://dbgekqlyliksvipakmpg.supabase.co',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            // 不覆盖 headers — supabase-js 自己会带正确的 anon key
          },
        },
      },
      plugins: [
        react(),
        tailwindcss(),
        {
          name: 'vite-check-url-handler',
          configureServer(server) {
            // 拦截 /api/check-url，先于 proxy 执行（否则会被转发到 Supabase 404）
            server.middlewares.use('/api/check-url', async (req, res) => {
              const url = new URL(req.url!, `http://${req.headers.host}`);
              const target = url.searchParams.get('target');

              if (!target) {
                res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'missing target parameter' }));
                return;
              }

              const start = Date.now();
              try {
                const ctrl = new AbortController();
                const timer = setTimeout(() => ctrl.abort(), 12000);

                // HEAD first, GET fallback
                let resp;
                try {
                  resp = await fetch(target, {
                    method: 'HEAD',
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    },
                    signal: ctrl.signal,
                    redirect: 'follow',
                  });
                } catch {
                  resp = await fetch(target, {
                    method: 'GET',
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                      'Accept': 'text/html,application/xhtml+xml,*/*',
                      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    },
                    signal: ctrl.signal,
                    redirect: 'follow',
                  });
                }

                clearTimeout(timer);
                const latencyMs = Date.now() - start;

                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({
                  ok: resp.status < 400,
                  status: resp.status,
                  link_status: resp.status >= 400 ? 'broken' : 'ok',
                  reason: resp.status >= 400 ? `HTTP ${resp.status}` : undefined,
                  latency_ms: latencyMs,
                }));
              } catch (err) {
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({
                  ok: false,
                  link_status: 'broken',
                  reason: err.name === 'AbortError' ? '连接超时' : (err.message?.slice(0, 200) || '网络错误'),
                  latency_ms: Date.now() - start,
                }));
              }
            });

            // 拦截 /api/admin/users — 用户管理（管理员功能）
            // service key 从服务端 env 读取，绝不发给前端；前端传用户 token，服务端验证 admin
            server.middlewares.use('/api/admin/users', async (req, res) => {
              const url = new URL(req.url!, `http://${req.headers.host}`);
              const serviceKey = (env as any).VITE_SERVICE_KEY || (process.env.VITE_SERVICE_KEY as string) || '';

              if (!serviceKey) {
                res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: '服务端未配置 VITE_SERVICE_KEY 环境变量' }));
                return;
              }

              // 校验调用者身份：Authorization: Bearer <用户 token>
              const authHeader = (req.headers['authorization'] as string) || '';
              if (!authHeader.startsWith('Bearer ')) {
                res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: '未登录' }));
                return;
              }
              const userToken = authHeader.slice(7);

              // 解析 uid（GoTrue 需要 apikey + Authorization 两个头）
              const userResp = await fetch(
                'https://dbgekqlyliksvipakmpg.supabase.co/auth/v1/user',
                { headers: { apikey: serviceKey, Authorization: `Bearer ${userToken}` } }
              );
              if (!userResp.ok) {
                res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: '登录状态无效，请重新登录' }));
                return;
              }
              const authUser = await userResp.json();
              const uid = authUser.id;
              if (!uid) {
                res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: '无法识别用户身份' }));
                return;
              }

              // 查 profiles 确认管理员
              const profileResp = await fetch(
                `https://dbgekqlyliksvipakmpg.supabase.co/rest/v1/profiles?select=role&id=eq.${uid}`,
                { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
              );
              const profiles = await profileResp.json().catch(() => []);
              if (!Array.isArray(profiles) || profiles[0]?.role !== 'admin') {
                res.writeHead(403, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: '无权限：仅管理员可操作' }));
                return;
              }

              try {
                if (req.method === 'GET') {
                  const email = url.searchParams.get('email');
                  if (!email) {
                    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ error: '缺少 email 参数' }));
                    return;
                  }
                  // GoTrue /admin/users filter 直接传值，不是 PostgREST 语法
                  const resp = await fetch(
                    `https://dbgekqlyliksvipakmpg.supabase.co/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
                    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
                  );
                  const data = await resp.json();
                  res.writeHead(resp.status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                  res.end(JSON.stringify(data));
                } else if (req.method === 'PUT') {
                  const userId = url.searchParams.get('id');
                  if (!userId) {
                    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ error: '缺少 id 参数' }));
                    return;
                  }
                  const body = await new Promise<string>((resolve) => {
                    let data = '';
                    req.on('data', chunk => data += chunk);
                    req.on('end', () => resolve(data));
                  });
                  const resp = await fetch(
                    `https://dbgekqlyliksvipakmpg.supabase.co/auth/v1/admin/users/${userId}`,
                    {
                      method: 'PUT',
                      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
                      body,
                    }
                  );
                  const data = await resp.json();
                  res.writeHead(resp.status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                  res.end(JSON.stringify(data));
                } else {
                  res.writeHead(405, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                  res.end(JSON.stringify({ error: '不支持的方法' }));
                }
              } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: err.message }));
              }
            });
          },
        },
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom', 'react-spinners', 'lucide-react'],
              supabase: ['@supabase/supabase-js']
            }
          }
        }
      }
    };
});
