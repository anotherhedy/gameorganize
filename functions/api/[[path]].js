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

  // 原样转发 headers，supabase-js 已带 anon key
  const headers = new Headers(request.headers);
  headers.delete('host'); // 让 Supabase 收到自己的 host

  const body = ['GET', 'HEAD'].includes(request.method) ? null : await request.text();

  const resp = await fetch(targetUrl, { method: request.method, headers, body });

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: {
      'Content-Type': resp.headers.get('Content-Type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
