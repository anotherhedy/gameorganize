/**
 * 游戏链接有效性检查脚本
 *
 * 用法:
 *   node scripts/check-links.mjs              # 检查所有游戏链接
 *   node scripts/check-links.mjs --csv        # 同时输出 CSV 报告
 *   node scripts/check-links.mjs --timeout 15 # 自定义超时（秒）
 *   node scripts/check-links.mjs --concurrency 10  # 自定义并发数
 *
 * 工作原理:
 *   1. 从 Supabase games 表拉取所有游戏 URL
 *   2. 对每个 URL 发送 GET 请求（HEAD 经常被拦截）
 *   3. 检查 HTTP 状态码 + 响应内容，识别"软 404"
 *   4. 分平台做针对性检测（itch.io、Steam、B站、网盘等）
 *   5. 输出检测报告
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ========== 配置 ==========

// 解析命令行参数
const args = process.argv.slice(2);
const FLAGS = {
  csv: args.includes('--csv'),
  json: args.includes('--json'),
  verbose: args.includes('--verbose') || args.includes('-v'),
  timeout: parseInt(args[args.indexOf('--timeout') + 1]) || 10,
  concurrency: parseInt(args[args.indexOf('--concurrency') + 1]) || 5,
  limit: parseInt(args[args.indexOf('--limit') + 1]) || 0,
};

// 从 .env 读取 Supabase 配置
function loadEnv() {
  try {
    const envPath = resolve(PROJECT_ROOT, '.env');
    const content = readFileSync(envPath, 'utf-8');
    const env = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1).replace(/^["']|["']$/g, '');
    }
    return env;
  } catch {
    console.error('❌ 无法读取 .env 文件');
    process.exit(1);
  }
}

const ENV = loadEnv();
const SUPABASE_URL = ENV.VITE_SUPABASE_URL || 'https://dbgekqlyliksvipakmpg.supabase.co';
const ANON_KEY = ENV.VITE_SUPABASE_ANON_KEY;

// ========== 平台特定检测规则 ==========

/**
 * 各平台的"失效"特征
 * 返回 null 表示无法通过内容判断，依赖 HTTP 状态码
 * 返回 { dead: true, reason: '...' } 表示确认失效
 * 返回 { dead: false } 表示确认有效
 */
function detectSoft404(url, html, statusCode) {
  const host = (() => { try { return new URL(url).hostname; } catch { return ''; } })();

  // === itch.io ===
  if (host.includes('itch.io')) {
    if (html.includes('page not found') || html.includes("couldn't find") || html.includes('game not found')) {
      return { dead: true, reason: 'itch.io 页面不存在（游戏已下架）' };
    }
    return { dead: false }; // itch.io 非 404 页面基本都有效
  }

  // === Steam ===
  if (host.includes('steampowered.com') || host.includes('store.steampowered.com')) {
    if (html.includes('An error was encountered while processing your request') ||
        html.includes('This item is currently unavailable')) {
      return { dead: true, reason: 'Steam 页面不可用（游戏可能已下架或地区限制）' };
    }
    // Steam 即使游戏下架也可能 200，但页面内容会不同
    if (!html.includes('game_area_purchase') && !html.includes('apphub_AppName') && !html.includes('glance_ctn')) {
      return { dead: true, reason: 'Steam 页面缺少游戏信息（可能已下架）' };
    }
    return { dead: false };
  }

  // === Bilibili / b23.tv ===
  if (host.includes('bilibili.com') || host.includes('b23.tv')) {
    if (html.includes('视频不见了') || html.includes('页面不见了') || html.includes('啊叻？页面不见了') ||
        html.includes('啥也没有') || html.includes('视频去哪了')) {
      return { dead: true, reason: 'B站视频已被删除或失效' };
    }
    return { dead: false };
  }

  // === YouTube ===
  if (host.includes('youtube.com') || host.includes('youtu.be')) {
    if (html.includes('Video unavailable') || html.includes('This video is not available') ||
        html.includes('This video has been removed')) {
      return { dead: true, reason: 'YouTube 视频已失效或被删除' };
    }
    return { dead: false };
  }

  // === 百度网盘 ===
  if (host.includes('pan.baidu.com')) {
    if (html.includes('分享文件已经被取消') || html.includes('分享文件已经被删除') ||
        html.includes('链接不存在') || html.includes('啊哦，你来晚了') ||
        html.includes('此链接分享内容可能因为涉及')) {
      return { dead: true, reason: '百度网盘分享已取消或被删除' };
    }
    if (html.includes('请输入提取码') || html.includes('提取文件')) {
      return { dead: false }; // 还在，只是需要提取码
    }
    // 百度网盘总是 200，无法精准判断 → 标记为"不确定"
    return null;
  }

  // === 蓝奏云 / lanzou ===
  if (host.includes('lanzou') || host.includes('lanzoux')) {
    if (html.includes('文件取消分享') || html.includes('文件不存在') || html.includes('来晚啦') ||
        html.includes('被和谐')) {
      return { dead: true, reason: '蓝奏云文件已取消或失效' };
    }
    return { dead: false };
  }

  // === 阿里云盘 ===
  if (host.includes('aliyundrive.com') || host.includes('alipan.com')) {
    if (html.includes('分享已失效') || html.includes('文件不存在') || html.includes('来晚了')) {
      return { dead: true, reason: '阿里云盘分享已失效' };
    }
    return { dead: false };
  }

  // === 夸克网盘 ===
  if (host.includes('quark.cn')) {
    if (html.includes('分享已失效') || html.includes('文件已删除') || html.includes('不存在')) {
      return { dead: true, reason: '夸克网盘分享已失效' };
    }
    return { dead: false };
  }

  // === 通用: 通过标题/关键词判断 ===
  const lowerHtml = html.toLowerCase();
  // 404 页面特征
  const deadPatterns = [
    '<title>404',
    '<title>page not found',
    '<title>not found',
    '<title>页面不存在',
    '<title>错误</title>',
    '>404 not found<',
    '>the page you are looking for cannot be found',
    '>this page could not be found',
  ];
  for (const pattern of deadPatterns) {
    if (lowerHtml.includes(pattern)) {
      return { dead: true, reason: '页面返回 404（通用检测）' };
    }
  }

  return null; // 无法判断
}

// ========== HTTP 检查 ==========

/** 解析重定向 URL（处理相对路径） */
function resolveRedirect(baseUrl, location) {
  if (!location) return null;
  try {
    return new URL(location, baseUrl).href;
  } catch {
    return null;
  }
}

async function fetchWithFallback(url, opts) {
  try {
    return await fetch(url, opts);
  } catch (err) {
    // 相对路径重定向 → 尝试手动解析
    if (err.message?.includes('Failed to parse URL') && opts.redirect === 'follow') {
      // 先禁用自动跟随，手动处理
      const manualOpts = { ...opts, redirect: 'manual' };
      const resp = await fetch(url, manualOpts);
      if ([301, 302, 303, 307, 308].includes(resp.status)) {
        const location = resp.headers.get('location');
        if (location) {
          const resolved = resolveRedirect(url, location);
          if (resolved && resolved !== url) {
            return fetch(resolved, { ...opts, redirect: 'follow' });
          }
        }
      }
      return resp;
    }
    throw err;
  }
}

async function checkUrl(url, timeout) {
  const result = {
    url,
    statusCode: null,
    error: null,
    redirectedTo: null,
    dead: false,
    deadReason: null,
    checked: false,
    responseTime: 0,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout * 1000);

  const startTime = Date.now();
  const commonHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  };

  try {
    // 先试 HEAD（快），手动处理重定向
    let resp = await fetch(url, {
      method: 'HEAD',
      headers: commonHeaders,
      signal: controller.signal,
      redirect: 'manual',
    });

    result.statusCode = resp.status;
    result.responseTime = Date.now() - startTime;

    // 处理重定向
    if ([301, 302, 303, 307, 308].includes(resp.status)) {
      const location = resp.headers.get('location') || '';
      result.redirectedTo = resolveRedirect(url, location) || location;
      if (result.redirectedTo && result.redirectedTo !== url) {
        try {
          resp = await fetch(result.redirectedTo, {
            method: 'HEAD',
            headers: commonHeaders,
            signal: controller.signal,
            redirect: 'follow',
          });
          result.statusCode = resp.status;
          result.responseTime = Date.now() - startTime;
        } catch (e) {
          // 重定向目标不可达，保留原始重定向状态
        }
      }
    }

    // HEAD 被拒绝的方法 → 改用 GET
    const headBlocked = [405, 403, 501].includes(resp.status);
    // 对非 2xx/3xx 也做 GET 尝试（有些服务器不支持 HEAD）
    const shouldTryGet = headBlocked || (resp.status >= 400 && resp.status !== 404 && resp.status !== 410);

    if (shouldTryGet) {
      try {
        resp = await fetchWithFallback(url, {
          method: 'GET',
          headers: commonHeaders,
          signal: controller.signal,
          redirect: 'follow',
        });
      } catch (fetchErr) {
        // GET 也失败，保留 HEAD 的结果
        if (!result.error) {
          result.error = fetchErr.message?.slice(0, 100);
        }
      }

      if (resp) {
        result.statusCode = resp.status;
        result.responseTime = Date.now() - startTime;

        // 读前 200KB 做内容分析
        if (resp.ok) {
          try {
            const text = await resp.text();
            const snippet = text.slice(0, 200000);
            const softCheck = detectSoft404(url, snippet, resp.status);
            if (softCheck?.dead) {
              result.dead = true;
              result.deadReason = softCheck.reason;
            }
          } catch { /* 无法读取 body，依赖状态码 */ }
        }
      }
    }

    // 4xx/5xx → 直接标记失效
    if (resp.status >= 400) {
      result.dead = true;
      result.deadReason = `HTTP ${resp.status}`;
    }

    result.checked = true;
  } catch (err) {
    result.responseTime = Date.now() - startTime;
    result.checked = true;

    if (err.name === 'AbortError') {
      result.error = `超时 (${timeout}s)`;
      result.dead = true;
      result.deadReason = '连接超时';
    } else if (err.message?.includes('ENOTFOUND') || err.message?.includes('getaddrinfo')) {
      result.error = 'DNS 解析失败';
      result.dead = true;
      result.deadReason = '域名不存在或无法解析';
    } else if (err.message?.includes('ECONNREFUSED')) {
      result.error = '连接被拒绝';
      result.dead = true;
      result.deadReason = '服务器拒绝连接';
    } else if (err.message?.includes('CERT') || err.message?.includes('SSL') || err.message?.includes('TLS')) {
      result.error = 'SSL/TLS 证书错误';
      result.dead = true;
      result.deadReason = '证书过期或无效';
    } else if (err.message?.includes('Failed to parse URL')) {
      result.error = 'URL 解析失败（可能是重定向到无效地址）';
      result.dead = true;
      result.deadReason = '链接已失效（服务器返回无效重定向）';
    } else {
      result.error = err.message?.slice(0, 100) || '未知错误';
      result.dead = true;
      result.deadReason = `网络错误: ${result.error}`;
    }
  } finally {
    clearTimeout(timer);
  }

  return result;
}

// ========== 从 Supabase 获取数据 ==========

async function fetchAllGames() {
  console.log('📡 正在从 Supabase 获取游戏列表...');

  const url = `${SUPABASE_URL}/rest/v1/games?select=id,title,url&order=id.asc`;
  const resp = await fetch(url, {
    headers: {
      apikey: ANON_KEY,
      Accept: 'application/json',
    },
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`获取游戏列表失败: HTTP ${resp.status} - ${body}`);
  }

  const games = await resp.json();
  console.log(`✅ 获取到 ${games.length} 个游戏\n`);
  return games;
}

// ========== 并发控制 ==========

async function asyncPool(concurrency, items, fn) {
  const results = [];
  const executing = new Set();

  for (const [index, item] of items.entries()) {
    const p = Promise.resolve().then(() => fn(item, index));
    results.push(p);
    executing.add(p);

    const clean = () => executing.delete(p);
    p.then(clean, clean);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

// ========== 主流程 ==========

async function main() {
  console.log('🔍 游戏链接有效性检查工具\n');
  console.log(`   超时: ${FLAGS.timeout}s | 并发: ${FLAGS.concurrency} | 限制: ${FLAGS.limit || '全部'}\n`);
  console.log('='.repeat(70));

  // 1. 获取所有游戏
  const games = FLAGS.limit > 0
    ? (await fetchAllGames()).slice(0, FLAGS.limit)
    : await fetchAllGames();

  // 2. 逐个检查
  console.log(`\n🔎 开始检查 ${games.length} 个链接...\n`);

  const results = await asyncPool(FLAGS.concurrency, games, async (game, index) => {
    const num = index + 1;
    if (FLAGS.verbose || num % 10 === 0 || num === 1 || num === games.length) {
      process.stdout.write(`  [${num}/${games.length}] ${game.title.slice(0, 40)}... `);
    }

    const result = await checkUrl(game.url, FLAGS.timeout);
    result.id = game.id;
    result.title = game.title;

    if (FLAGS.verbose || num % 10 === 0 || num === 1 || num === games.length) {
      if (result.dead) {
        console.log(`❌ ${result.deadReason || result.error}`);
      } else if (result.statusCode && result.statusCode < 400) {
        console.log(`✅ HTTP ${result.statusCode} (${result.responseTime}ms)`);
      } else {
        console.log(`⚠️  HTTP ${result.statusCode}`);
      }
    }

    return result;
  });

  console.log('\n' + '='.repeat(70));

  // 3. 统计和报告
  const dead = results.filter(r => r.dead);
  const alive = results.filter(r => r.checked && !r.dead);
  const redirects = results.filter(r => r.redirectedTo);

  console.log('\n📊 检查结果汇总');
  console.log(`   总数: ${results.length}`);
  console.log(`   ✅ 正常: ${alive.length} (${(alive.length / results.length * 100).toFixed(1)}%)`);
  console.log(`   ❌ 失效: ${dead.length} (${(dead.length / results.length * 100).toFixed(1)}%)`);
  console.log(`   🔀 重定向: ${redirects.length}`);

  // 4. 失效链接详情
  if (dead.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('\n❌ 失效链接详情:\n');

    // 按原因分组
    const byReason = {};
    for (const r of dead) {
      const reason = r.deadReason || '未知';
      if (!byReason[reason]) byReason[reason] = [];
      byReason[reason].push(r);
    }

    for (const [reason, items] of Object.entries(byReason)) {
      console.log(`  📍 ${reason} (${items.length}个):`);
      for (const item of items) {
        console.log(`     - [${item.id}] ${item.title}`);
        console.log(`       ${item.url}`);
      }
      console.log();
    }
  }

  // 5. 输出 CSV
  if (FLAGS.csv) {
    const csvPath = resolve(PROJECT_ROOT, 'link-check-report.csv');
    const header = 'ID,游戏名,URL,状态,HTTP状态码,失效原因,响应时间(ms),错误信息\n';
    const rows = results.map(r => {
      const status = r.dead ? '失效' : (r.checked ? '正常' : '未检查');
      const escape = v => `"${String(v || '').replace(/"/g, '""')}"`;
      return `${r.id},${escape(r.title)},${escape(r.url)},${status},${r.statusCode || ''},${escape(r.deadReason)},${r.responseTime},${escape(r.error)}`;
    }).join('\n');
    writeFileSync(csvPath, '﻿' + header + rows, 'utf-8');
    console.log(`📄 CSV 报告已保存: ${csvPath}`);
  }

  // 6. 输出 JSON
  if (FLAGS.json) {
    const jsonPath = resolve(PROJECT_ROOT, 'link-check-report.json');
    writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`📄 JSON 报告已保存: ${jsonPath}`);
  }

  // 7. 建议
  console.log('\n💡 建议:');
  console.log('   - 标记为"超时"的链接可能是临时网络问题，建议重试');
  console.log('   - 网盘类链接（百度/阿里/夸克）可能实际有效但返回 200，需人工确认');
  console.log(`   - 使用 --verbose 查看每个链接的详细信息`);
  console.log(`   - 使用 --csv 导出 CSV 报表`);
  console.log(`   - 使用 --json 导出 JSON 报表`);
  console.log(`   - 使用 --concurrency N 调整并发数（默认 5）\n`);
}

main().catch(err => {
  console.error('❌ 脚本执行失败:', err);
  process.exit(1);
});
