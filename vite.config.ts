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

            // 拦截 /api/admin/users — 用户管理（需要 service key）
            server.middlewares.use('/api/admin/users', async (req, res) => {
              const url = new URL(req.url!, `http://${req.headers.host}`);
              const serviceKey = (req.headers['x-service-key'] as string) || '';

              if (!serviceKey) {
                res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: '未授权：缺少 service key' }));
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
                  const resp = await fetch(
                    `https://dbgekqlyliksvipakmpg.supabase.co/auth/v1/admin/users?filter=email+eq+%22${encodeURIComponent(email)}%22`,
                    { headers: { Authorization: `Bearer ${serviceKey}` } }
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
                      headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
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
