# S.E.A. 特调局 — 网页解谜游戏档案站

## 技术栈

| 层 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite 6 + Tailwind CSS 4 |
| 后端服务 | Supabase (PostgreSQL, Auth, Storage) |
| 部署 | Cloudflare Pages（静态托管 + Functions） |
| 代理层 | Cloudflare Pages Function (`/api/*`) |

## 架构图

```
┌─────────────────────────────────────────────────────┐
│                    用户浏览器                         │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ 浏览游戏     │  │ 登录/注册     │  │ 提交投稿    │ │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                │                │         │
└─────────┼────────────────┼────────────────┼─────────┘
          │                │                │
    海外/VPN               │         国内无VPN
          │                │                │
          ▼                │                ▼
   直连 Supabase           │      /api (CF Pages Function)
   (快速)                  │                │
          │                │                ▼
          └────────────────┼──────► Cloudflare 边缘节点
                           │                │
                           ▼                ▼
                       Supabase (PostgreSQL + Storage + Auth)
```

### 智能选路（`detectApiBase()`）

页面加载时自动探测：
- **直连可达**（< 3s）→ 全部请求直连 Supabase（海外/VPN 用户）
- **直连超时** → 全部请求走 `/api` 代理（国内用户）

结果缓存 `localStorage` 30 分钟，后续请求零额外延迟。

## 数据库设计

### `games` 表 — 已通过的游戏（干净，无审核字段）

| 列 | 类型 | 说明 |
|------|------|------|
| id | text | 主键（兼容自增与手动） |
| title | text | 游戏名称 |
| url | text | 游戏链接 |
| description | text | 简介 |
| image_url | text | 封面图 |
| category | text[] | 时长标签 |
| tags | text[] | PC/PE/跳杀/声音 |
| author_name | text | 作者名 |
| author_url | text | 作者链接 |
| answer_text | text | 攻略文字 |
| answer_url | text | 攻略链接 |
| created_at | timestamptz | 入库时间 |

### `game_submissions` 表 — 投稿审核队列（独立，不污染 games）

| 列 | 类型 | 说明 |
|------|------|------|
| id | serial | 自增主键 |
| title, url, description, duration | text | 同 games |
| image_url, author_name, author_url, answer_url | text | 同 games |
| pc, pe, jumpscare, sound | boolean | 平台/标签 |
| submitted_by | uuid | 投稿人 |
| status | text | 审核中 / 已通过 / 已驳回 |
| review_comment | text | 驳回原因 |
| created_at, reviewed_at | timestamptz | 时间戳 |

## 核心流程

### 用户投稿

```
用户提交 → game_submissions (status=审核中)
                ↓
         管理员审核
         ├─ 通过 → RPC approve_submission() → INSERT games + UPDATE submission
         └─ 驳回 → RPC reject_submission() → UPDATE submission (status=已驳回 + 原因)
```

### 管理员提交流程

```
管理员提交 → adminDirectSubmit() → 直写 games 表，跳过审核
```

管理员与用户使用**同一套提交表单 UI**，仅提交时调不同 API。

## 项目结构

```
src/
├── services/supabase/
│   ├── supabaseClient.ts   # supabase-js 实例（仅用于 Auth）
│   └── api.ts              # 所有数据/存储 API（原生 fetch + 双路 + 超时控制）
├── components/
│   ├── admin/
│   │   ├── AdminCMS.tsx     # 审核队列 + 编辑模式
│   │   └── ReviewQueue.tsx  # 折叠式审核列表
│   ├── auth/
│   │   └── UserDashboard.tsx # 左侧滑出用户面板
│   ├── game/
│   │   ├── GameCard.tsx     # 游戏卡片
│   │   └── SubmitGameModal.tsx # 提交档案（用户+管理员公用）
│   └── layout/Header.tsx
├── types/index.ts
└── App.tsx

functions/
└── api/[[path]].js          # CF Pages Function 代理（透明转发到 Supabase）

migrations/
└── 001_game_submissions.sql # 建投稿表 + RLS + RPC 函数
```

## 部署

```bash
npm run build          # 构建到 dist/
git push origin main   # 自动触发 CF Pages 部署
```

### Cloudflare Pages 环境变量

| 变量 | 说明 |
|------|------|
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable key |

### Supabase 必跑迁移

1. `migrations/001_game_submissions.sql` — 建投稿表 + RPC
2. Storage policy:
```sql
CREATE POLICY "允许登录用户上传" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'game-covers' AND auth.role() = 'authenticated');
```

## 本地开发

```bash
npm run dev           # Vite 开发服务器
                      # /api 请求通过 Vite proxy → Supabase（无 Pages Function 也 OK）
```
