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
