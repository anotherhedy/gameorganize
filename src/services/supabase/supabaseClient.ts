import { createClient } from '@supabase/supabase-js'

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable')
}

// 开发：Vite proxy 转发 /api → Supabase（vite.config.ts）
// 生产：Cloudflare Pages Function 转发 /api → Supabase（functions/api/[[path]].js）
// supabase-js 要求绝对 URL，拼接当前域名（dev: localhost:3000, prod: xxx.pages.dev）
const apiUrl = `${window.location.origin}/api`
console.log('[Supabase] 通过 /api 代理访问', apiUrl)

export const supabase = createClient(apiUrl, supabaseAnonKey)
