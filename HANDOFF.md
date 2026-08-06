# 特殊事件档案库 — 项目交付文档（给下一位 AI）

> **编写时间**：2026-08-06
> **用途**：把项目现状、用户端行为、未提交改动、待决策事项完整交接给下一位接手 AI，避免重新摸索。
> **⚠️ 重要**：本目录的 `README.md` 已部分过时（未包含 feedback 表、角色体系、迁移 002~004 等），**以本文档为准**。

---

## 1. 一句话概况

一个 **网页解谜游戏档案站**「特殊事件档案库」（S.E.A. DATABASE），游戏站长在 Cloudflare Pages 上的 React 单页应用。玩家可浏览/搜索/随机抽取恐怖解谜游戏、标记"已侦破"进度、登录后投稿游戏、在"情报墙"发帖反馈；管理员/内容编辑可审核投稿、管理游戏、管理用户。

- **生产地址**：https://gameorganize.pages.dev
- **仓库**：`github-new:anotherhedy/gameorganize.git`（远程名 `origin` 指向的 GitHub）
- **当前工作分支**：`test-api-proxy`（main 是生产分支，见 §12 部署约束）

---

## 2. 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Vite 6 + Tailwind CSS 4 |
| 列表虚拟滚动 | react-virtuoso |
| 简繁转换 | opencc-js |
| 后端 | Supabase（PostgreSQL + Auth/GoTrue + 少量 RPC） |
| 部署 | Cloudflare Pages（静态 + Functions） |
| 代理层 | Cloudflare Pages Function `functions/api/[[path]].js` |

无后端框架、无 SSR、无数据库 ORM —— 所有数据走 `src/services/supabase/api.ts` 里的原生 fetch。

---

## 3. 目录结构（当前实际）

```
src/
├── App.tsx                        # 主入口：数据加载、路由切换(纯 state)、筛选/排序、随机抽取、权限推导
├── index.tsx
├── types/index.ts                 # 所有共享接口（GameData / GameSubmission / Feedback / AdminRole）
├── services/supabase/
│   ├── supabaseClient.ts          # supabase-js 实例（仅用于 Auth；数据请求不走它）
│   └── api.ts                     # ★全部数据 API：智能选路 + 原生 fetch + 超时 + 缓存
├── components/
│   ├── admin/AdminCMS.tsx         # 管理后台：审核队列 + 游戏管理 + 用户管理
│   ├── admin/ReviewQueue.tsx      # 折叠式审核列表（AdminCMS 子组件）
│   ├── auth/AuthModal.tsx         # 登录/注册弹窗 + 忘记密码引导
│   ├── auth/UserDashboard.tsx     # 左侧滑出用户中心
│   ├── game/GameCard.tsx          # 游戏卡片
│   ├── game/SubmitGameModal.tsx   # 提交档案弹窗（用户+管理员公用）
│   ├── intel/FloatingEntry.tsx    # 右下角"情报墙"悬浮入口
│   ├── intel/IntelligenceWall.tsx # 情报墙页面（懒加载）
│   ├── intel/IntelCard.tsx        # 情报卡片（贴纸风）
│   ├── intel/IntelModal.tsx       # 发布/编辑情报弹窗
│   ├── intel/IntelReplyModal.tsx  # 管理员回复情报弹窗
│   └── layout/Header.tsx          # 首页 hero + 介绍 + 两个小红书账号链接
functions/api/[[path]].js          # CF Pages Function：Supabase 透明代理 + /ping + /check-url + /admin/users
migrations/001~004_*.sql          # 数据库迁移（见 §11）
public/                            # 图片、字体、textures/（本地纹理）
scripts/                           # check-links 等运维脚本
tests/                             # 早期 Playwright 测试产物（screenshots 等，可能是废弃的）
```

---

## 4. 数据模型（Supabase）

### `games` — 已通过的游戏（主数据）
id(text), title, url, description, image_url, category(text[]，时长), tags(text[]，PC/PE/有跳杀/有声音), author_name, author_url, answer_text, answer_url, **link_status**('ok'|'broken'|'unknown'), **link_checked_at**, created_at

### `game_submissions` — 投稿审核队列
id(serial), 与 games 同的字段, pc/pe/jumpscare/sound(boolean), submitted_by(uuid), status('审核中'|'已通过'|'已驳回'), review_comment, created_at, reviewed_at

### `feedback` — 情报墙
id, **detective_name**, **intel_content**, **reply_content**, **replied_by**(管理员回复时的"管理员·昵称"，迁移003新增), **user_id**, created_at

### `profiles` — 用户档案
id(uuid), **username**, **xhs_id**, **role**('user'默认 | 'normal_admin'内容编辑 | 'admin'超管), **solved_game_ids**(text[]，已侦破进度), updated_at

### `game_stats` — 浏览量
game_id, views（经 RPC `increment_game_views` 累加）

---

## 5. 角色权限体系（核心）

| 角色 | role 值 | 前端推导 | 能力 |
|---|---|---|---|
| 普通用户 | `user` | — | 浏览、搜索、随机、标记已侦破、投稿、情报墙发帖 |
| 内容编辑 | `normal_admin` | `isAdmin=true`（`profile.role==='normal_admin'`） | 审核投稿、回复情报、发布游戏（直写）、管理后台可见 |
| 超级管理员 | `admin` | `isSuperAdmin=true` | 内容编辑全部能力 + 删除情报、**用户管理**（改角色/重置密码） |

- **角色唯一权威 = `profiles.role` 列**（`App.tsx:72` 的 `adminRole` 只从 `profile?.role` 派生，**不再**回退 `user_metadata.role`）。
- **管理员/内容编辑情报身份统一为「管理员·昵称」**：回复情报时写 `replied_by = '管理员·' + username`；发布情报时前端自动加 `管理员·` 前缀；个人中心标签区分 `管理员` / `内容编辑`。

---

## 6. 用户端功能全览（重点，按玩家视角）

### 6.1 游客（未登录）
- 首页：hero 介绍（含两个小红书账号链接：@摸鱼侦探社🎰、@常棣）+ 三个 Tab（全部档案库/热门排行/最新收录）
- 搜索：按名称/作者，**支持简繁双向**（opencc-js）
- 筛选器（桌面/移动两套 UI）：时长（<1h/1-3h/>3h）、标签（有声音/微恐）、平台（PC/手机）、排序（最新发布/浏览量）
- **随机抽取**：紫蓝渐变按钮 → 全屏抽取动画 600ms → 弹窗显示推荐游戏（可重抽/立即启动）。带防连点（`isPickingRef`，App.tsx:68）
- 卡片点击"启动"→ 新标签打开游戏链接 + 浏览量 +1（`incrementGameViews`）
- 右下角悬浮按钮 → 进入**情报墙**；情报墙可发帖（限未登录也可，昵称"匿名研究员"）
- 卡片显示"链接已失效"状态（`link_status==='broken'` 时渲染 span 而非 `<a href="#">`）

### 6.2 注册/登录（AuthModal）
- 注册需：研究员代号(必填)、小红书 ID(选填)、邮箱、密码 → 注册成功自动登录并提示"入职成功"
- 注册时 `upsertProfile` **不传 role**（数据库默认 `'user'`，防提权）
- **忘记密码**：登录框底部提示 → 点击跳转小红书 **@常棣**（提供注册邮箱，管理员重置密码），不用 Supabase 邮件（国内收不到）
- 登录状态持久化由 Supabase JWT 管理

### 6.3 用户中心（UserDashboard，左侧滑出）
- 顶部：头像、昵称、管理员/内容编辑徽章、三张统计卡（已侦破/投稿/通过）
- 快捷按钮：提交档案、随机抽取、编辑资料、**管理中心**（仅 admin，带待审数量红点）
- **概览**：侦破进度条（已侦破/总数）+ 已侦破游戏列表（>8 个折叠"展开全部"）+ 最近 3 条投稿
- **投稿**：我的投稿列表（>5 条折叠"展开全部"），状态徽章（审核中/已通过/已驳回），驳回显示原因；未通过的投稿可删除
- **资料**：改昵称、小红书 ID、**改密码**（登录态直接 `updateUser`，免邮件）、保存资料、退出登录

### 6.4 提交档案（SubmitGameModal）
- 用户提交 → 写 `game_submissions`（status=审核中），等管理员审批；提交前查重（`checkDuplicateGame`，games + 审核中投稿两处查）
- 管理员/内容编辑提交 → 走 `adminDirectSubmit()` **直写 games 表**，跳过审核（同一套表单 UI，不同 API）
- 可编辑已有投稿（`resubmitSubmission`，重置为审核中）

### 6.5 情报墙（IntelligenceWall）⭐近期重点优化对象
- 贴纸风卡片（旋转/底色按 index 分配），每页 6 条，`created_at` 倒序
- **发帖**：每天最多 3 条、内容 ≤200 字（localStorage 计数）；已登录昵称锁定为注册代号
- 已登录用户可**编辑自己**的情报；管理员可**回复**任何情报（显示「管理员·昵称」）；超管可**删除**
- 回复展示：卡片底部红色"已阅"区 + 回复内容
- ⚠️ **未提交的性能优化已改好**（见 §10），核心：发帖/回复/删除后**乐观更新本地 state、不再整页重拉**；`count=exact→estimated`；给 `feedback.created_at` 建索引（迁移004）

---

## 7. 管理员/内容编辑端（AdminCMS）

- 入口：用户中心 → 管理中心（红点显示待审数）
- **审核队列**：待审投稿列表，可"通过"（RPC `approve_submission`：插入 games + 改状态）/ "驳回"（RPC `reject_submission`：附原因）
- **游戏管理**：编辑/删除已收录游戏、直接新增（跳过审核）、检查链接状态
- **用户管理**（仅超管 `admin`，`isSuperAdmin` 为 false 时自动退回审核队列视图）：
  - 按邮箱搜索（走 `/api/admin/users`，GoTrue `/admin/users?filter=` 子串匹配）
  - 重置密码、改角色（role + password 可同时执行，前端不显示密码明文）
  - 多匹配时先弹"选哪个人"

---

## 8. 关键架构机制

### 8.1 智能选路 `detectApiBase()`（api.ts 顶部）
- 首次请求先探测直连 Supabase（**超时 0.6s，未提交代码已从 1.5s 缩短**）
- 直连可达 → 全部请求直连 Supabase（海外/VPN 用户，快）
- 直连超时 → 全部走 `/api`（CF Pages Function 代理，国内用户）
- 结果缓存 `localStorage` 30 分钟（**未提交代码已改为 24h**），并有内存 `_apiBase` 防重复探测

### 8.2 CF Pages 代理 `functions/api/[[path]].js`
- 透明转发 `/api/rest/v1/*` → Supabase，透传 headers/body
- 附加端点：`/api/ping`（连通性）、`/api/check-url`（服务端链接检测）、`/api/admin/users`（用户管理，service key 只在服务端）
- 本地开发由 `vite.config.ts` 的 middleware 镜像同样逻辑（`SUPABASE_SERVICE_KEY` 从 `env`/`process.env` 读）

### 8.3 安全设计（重要，勿破坏）
- **防提权**（迁移002）：`profiles.role` 列对 `authenticated` **只读**（`REVOKE INSERT/UPDATE(role)`），用户无法自写角色
- **RPC 权限**：`approve_submission`/`reject_submission` 带 `auth.uid()` 角色校验（仅 admin/normal_admin），且 `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO authenticated`
- **service key 不落地前端**：`SUPABASE_SERVICE_KEY`（非 VITE_ 前缀）只在 CF Function / vite middleware 服务端使用，前端包永不包含
- **用户管理端点校验链**：前端传用户 token → 服务端 `/auth/v1/user` 解析 uid → 查 `profiles.role` 必须 `admin` → 才执行

---

## 9. 当前工作区状态（重要！有未提交改动）

**当前分支 `test-api-proxy`，以下改动已做但【未提交】**，`git status`：

```
 M src/components/intel/IntelligenceWall.tsx   # 情报墙乐观更新
 M src/services/supabase/api.ts                # count=estimated + 选路提速(0.6s/24h) + insertFeedback 返回插入行
 ?? migrations/004_feedback_perf.sql           # 新建：feedback(created_at DESC) 索引
 ?? public/textures/cubes.png                  # 情报墙背景纹理本地化（原来用国外图床）
 ?? tests/                                     # 早期测试产物（可能是废弃的）
```

这几项都是**情报墙性能优化**（见 §6.5 末行），`tsc --noEmit` 已通过。用户要求**先不提交，还有别的要改**。

> ⚠️ `migrations/004_feedback_perf.sql` 是**数据库迁移**，需要用户去 Supabase Dashboard 执行（一行 CREATE INDEX）。前端代码 + 索引必须一起上线才有效。

---

## 10. 待决策事项（用户仍在确认）

### Egress 免费额度优化（已设计方案，未实施）

用户 Supabase 免费版 **Egress 已用 0.84/5 GB（17%）**，当前月才过 1/5，按线性推月约 4.2GB 接近上限；超限会导致**项目被暂停**。根因：每次打开首页 `fetchAllGames()` 全量下载整张 games 表 + `fetchGameStats()` 全量拉浏览量，无任何缓存。

**已与用户敲定的方案（"只缓存低频只读数据，用户内容一律不碰"）**：
- 仅给 `fetchAllGames` + `fetchGameStats` 套一层 **localStorage 短缓存**（约 10 分钟 TTL）
- **绕过条件 = 只要登录就永远走最新**（不查角色，避免异步竞态；管理员/内容编辑必然登录 → 天然无影响）
- **绝不对以下数据做缓存**：feedback（情报墙）、game_submissions（投稿）、profiles（个人资料）、审核队列 → 用户发帖/投稿/审批全部实时
- CDN 层缓存（②）**暂不做**（需按接口路径精确白名单，风险高、收益是二层）

**尚未实施**——若下一位 AI 接手到"做 egress 优化"，先与用户确认此方案再动手。

---

## 11. 数据库迁移清单（Dashboard → SQL Editor 手动执行）

| 迁移 | 内容 | 状态 |
|---|---|---|
| `001_game_submissions.sql` | 建投稿表 + RLS + RPC | ✅ 已执行 |
| `002_role_security.sql` | 防提权 + RPC 角色校验 + 旧 metadata 管理员迁移 | ✅ 已执行（用户确认） |
| `003_feedback_replied_by.sql` | feedback 加 replied_by 列 | ✅ 已执行（用户确认） |
| `004_feedback_perf.sql` | **feedback(created_at DESC) 索引** | ⚠️ **未执行，需用户跑** |

> 002 迁移注释里提到"若 profiles 未启用 RLS 建议补两行 ALTER TABLE + 策略"——需确认 Dashboard 是否已启用 RLS（涉及用户能否读自己资料）。

---

## 12. 部署工作流（重要约束，勿违反）

用户明确要求：**不要直接 push main，必须先部署到预览分支验证**。

1. 在 `test-api-proxy` 分支开发 → `git push origin test-api-proxy` → CF Pages 自动部署预览环境
2. 用户验证 OK 后，用户会说"**可以合并 main 正式部署**"
3. 然后 `git checkout main && git merge test-api-proxy && git push origin main`（fast-forward）→ 生产部署
4. 若中途改动：回到 test-api-proxy 迭代，重复

**生产当前版本**：main = `ae9480b`（已部署，含安全加固 P0~P3 + 管理员情报身份 + 忘记密码引导）。

---

## 13. 环境变量

**本地 `.env`**（gitignored）：
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=        # 注意：曾从 VITE_SERVICE_KEY 改名而来，避免打进前端包
```

**Cloudflare Pages**：
- Build env：`VITE_SUPABASE_ANON_KEY`、`VITE_SUPABASE_URL`
- Functions env：`SUPABASE_SERVICE_KEY`（服务端专用）

> Supabase URL：`https://dbgekqlyliksvipakmpg.supabase.co`
> ⚠️ `vite.config.ts` 里有 `process.env.API_KEY`/`process.env.GEMINI_API_KEY` 的 define，但 `.env` 当前**没有** GEMINI_API_KEY——可能是历史遗留（grep 无业务引用），改代码时留意，不要误以为 AI 功能在线。

---

## 14. 已知问题 / 风险 / 建议

1. **Egress 超限风险**（最紧迫）：见 §10，需决定是否实施缓存方案。
2. **JWT 有效期**：历史上有"每次部署后用户掉登录"，根因是 Access Token 1h 过期。已加友好提示 UI，但**建议**在 Supabase Dashboard → Authentication → Settings 把 Access Token 改为 **604800s(7天)**、Refresh Token 改为 **7776000s(90天)**。**需确认用户是否已改**。
3. **README 过时**：未包含 feedback/角色/迁移 002~004，建议下一位 AI 顺手更新。
4. **`tests/` 目录**：内容是早期 Playwright 截图产物（来自已搁置的优化测试计划），可能应清理。
5. **情报墙旧版无索引**：已建迁移004，务必让用户执行。
6. **`select: '*'` 全字段查询**（fetchFeedbacks 等）：数据量大时可选列裁剪，暂非紧急。

---

## 15. 路线图（规划中，未实施）

来自上一份实施计划（`C:\Users\12989\.claude\plans\radiant-rolling-oasis.md`）第二期：
- 搜索时 hero 收起
- 弹窗 Escape 关闭 + 焦点锁定
- `fetchAllGames` 分页（响应体积减到 1/5）
- 情报墙分页优化（已部分完成：count=estimated + 索引）
- OG 标签 / meta description
- `user-scalable` 放开

---

## 16. 给下一位 AI 的操作提示

- **先看本文件 §9~§12**，确认未提交改动和部署约束后再动手。
- 改前端后必跑 `npx tsc --noEmit`。
- 与用户沟通用中文，用户偏"能听懂的大白话"；涉及部署/数据库操作要一步步给 Dashboard 操作步骤。
- 情报墙相关改动涉及乐观更新逻辑，注意 `IntelligenceWall.tsx` 里 `setFeedbacks`/`setTotal` 的本地更新与分页跳转的配合。
