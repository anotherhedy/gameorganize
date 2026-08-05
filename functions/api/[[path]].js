/**
 * Cloudflare Pages Function — Supabase API 代理
 * 纯透明转发，不动 headers。supabase-js 自带 anon key 认证。
 *
 * 国内用户浏览器 → Pages 同站点 /api/* → Cloudflare 边缘 → Supabase
 */
const SUPABASE_URL = 'https://dbgekqlyliksvipakmpg.supabase.co';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // /api/rest/v1/games... → /rest/v1/games...
  const pathname = url.pathname.replace(/^\/api/, '');
  const targetUrl = `${SUPABASE_URL}${pathname}${url.search}`;

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // 🔍 调试端点：测试 CF → Supabase 连通性
  if (pathname === '/ping') {
    const start = Date.now();
    try {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/games?select=id&limit=1`, {
        headers: { apikey: request.headers.get('apikey') || '' },
      });
      return new Response(JSON.stringify({
        ok: resp.ok,
        status: resp.status,
        latency_ms: Date.now() - start,
        data: await resp.json().catch(() => null),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (err) {
      return new Response(JSON.stringify({
        ok: false,
        latency_ms: Date.now() - start,
        error: err.message,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }

  // 🔍 链接检测端点：服务端代理检查目标 URL 是否可达
  if (pathname === '/check-url') {
    const target = url.searchParams.get('target');
    if (!target) {
      return new Response(JSON.stringify({ error: 'missing target parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const start = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);

    try {
      // 先试 HEAD（快），失败则 GET 回退
      let resp;
      try {
        resp = await fetch(target, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
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

      return new Response(JSON.stringify({
        ok: resp.status < 400,
        status: resp.status,
        link_status: resp.status >= 400 ? 'broken' : 'ok',
        reason: resp.status >= 400 ? `HTTP ${resp.status}` : undefined,
        latency_ms: latencyMs,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (err) {
      clearTimeout(timer);
      return new Response(JSON.stringify({
        ok: false,
        link_status: 'broken',
        reason: err.name === 'AbortError' ? '连接超时' : (err.message?.slice(0, 200) || '网络错误'),
        latency_ms: Date.now() - start,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }

  // 👤 用户管理端点（管理员功能）
  // 安全设计：service_role key 只在服务端 context.env，绝不发给前端。
  // 前端只传用户自己的登录 token，服务端验证其角色为 admin 后才执行。
  if (pathname === '/admin/users') {
    const serviceKey = context.env.SUPABASE_SERVICE_KEY || '';
    if (!serviceKey) {
      return new Response(JSON.stringify({ error: '服务端未配置 SUPABASE_SERVICE_KEY 环境变量' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // 1. 校验调用者身份：Authorization: Bearer <用户 token>
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: '未登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
    const userToken = authHeader.slice(7);

    // 2. 用用户 token 解析 uid（GoTrue 需要 apikey + Authorization 两个头）
    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${userToken}`,
      },
    });
    if (!userResp.ok) {
      return new Response(JSON.stringify({ error: '登录状态无效，请重新登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
    const authUser = await userResp.json();
    const uid = authUser.id;
    if (!uid) {
      return new Response(JSON.stringify({ error: '无法识别用户身份' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // 3. 查 profiles 确认调用者是管理员
    const profileResp = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=role&id=eq.${uid}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const profiles = await profileResp.json().catch(() => []);
    if (!Array.isArray(profiles) || profiles[0]?.role !== 'admin') {
      return new Response(JSON.stringify({ error: '无权限：仅管理员可操作' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    try {
      if (request.method === 'GET') {
        // 根据邮箱查找用户：GET /auth/v1/admin/users?filter=...
        const email = url.searchParams.get('email');
        if (!email) {
          return new Response(JSON.stringify({ error: '缺少 email 参数' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }
        // GoTrue /admin/users filter 直接传值，不是 PostgREST 语法
        const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`, {
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        });
        const data = await resp.json();
        return new Response(JSON.stringify(data), {
          status: resp.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      if (request.method === 'PUT') {
        const userId = url.searchParams.get('id');
        if (!userId) {
          return new Response(JSON.stringify({ error: '缺少 id 参数' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }
        const body = await request.json();

        // 角色变更：更新 profiles 表
        if (body.role) {
          const profileResp = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
            {
              method: 'PATCH',
              headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
              },
              body: JSON.stringify({ role: body.role }),
            }
          );
          const profileData = await profileResp.json();
          return new Response(JSON.stringify(profileData), {
            status: profileResp.status,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }

        // 密码重置：通过 GoTrue admin API
        if (body.password) {
          const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
              'apikey': serviceKey,
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password: body.password }),
          });
          const data = await resp.json();
          return new Response(JSON.stringify(data), {
            status: resp.status,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }

        return new Response(JSON.stringify({ error: '缺少 role 或 password 参数' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      return new Response(JSON.stringify({ error: '不支持的方法' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }

  // 原样转发 headers，supabase-js 已带 anon key
  const headers = new Headers(request.headers);
  headers.delete('host');

  // 用 request.body 直接透传（兼容文本和二进制，如图片上传）
  const body = ['GET', 'HEAD'].includes(request.method) ? null : request.body;

  const resp = await fetch(targetUrl, { method: request.method, headers, body });

  // 透传响应头
  const outHeaders = new Headers(resp.headers);
  outHeaders.set('Access-Control-Allow-Origin', '*');
  outHeaders.set('Access-Control-Allow-Headers', '*');

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: outHeaders,
  });
}
