/**
 * Cloudflare Worker — Supabase API 代理
 * 部署到 sea-api-proxy.1298999619.workers.dev
 *
 * 国内用户 → Worker（Cloudflare 边缘，全球可达）→ Supabase（边缘可达）
 * 免 VPN / 免绑卡 / 免额外申请
 */

const SUPABASE_URL = 'https://dbgekqlyliksvipakmpg.supabase.co';

export default {
  async fetch(request, env) {
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

    const url = new URL(request.url);
    const targetUrl = `${SUPABASE_URL}${url.pathname}${url.search}`;

    // 转发请求头，但用 service_role key 替换前端传来的 anon key
    const headers = new Headers();
    for (const [k, v] of request.headers.entries()) {
      // 跳过 host / origin（让 Supabase 收到自己的）
      if (['host', 'origin', 'referer'].includes(k.toLowerCase())) continue;
      headers.set(k, v);
    }
    // 用 Worker 的 service key（绕过 RLS，拥有完整权限）
    headers.set('apikey', env.SUPABASE_KEY);
    headers.set('Authorization', `Bearer ${env.SUPABASE_KEY}`);

    const body = ['GET', 'HEAD'].includes(request.method) ? null : await request.text();

    const resp = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    });

    // 返回响应 + CORS
    const outHeaders = new Headers();
    for (const [k, v] of resp.headers.entries()) {
      // 去掉可能导致跨域问题的头
      if (['content-encoding', 'transfer-encoding'].includes(k.toLowerCase())) continue;
      outHeaders.set(k, v);
    }
    outHeaders.set('Access-Control-Allow-Origin', '*');
    outHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    outHeaders.set('Access-Control-Allow-Headers', '*');

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: outHeaders,
    });
  },
};
