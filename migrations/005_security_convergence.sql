-- ============================================================
-- 迁移：安全收敛（005_security_convergence.sql）
--
-- 背景（线上事实，2026-08-06 已由外部核验）：
--   1. authenticated 对 profiles.role 的 INSERT / UPDATE 权限仍为 true
--      （旧 002_role_security.sql 的 REVOKE 从未在线上生效）
--   2. profiles 存在以下 5 条旧策略，其中含过宽 / 重复项：
--      - "anyone_can_read_profiles"                 SELECT public, USING true
--      - "Public profiles are viewable by everyone" SELECT public, USING true
--      - "Users can insert own profile"             INSERT public
--      - "Users can update own profile"             UPDATE public
--      - "users_can_manage_own_profile"             ALL authenticated（FOR ALL 过宽）
--   3. approve_submission(integer) / reject_submission(integer,text)
--      仍允许 anon / PUBLIC 执行
--   4. 两个审核函数均为 SECURITY DEFINER，且没有固定 search_path
--   5. 线上迁移记录为空，不能依赖旧 001/002 已执行
--
-- 本迁移基于"线上旧策略和旧权限可能仍存在"设计，全部语句可重复执行（幂等）。
-- 设计原则：
--   - profiles 用户可写列白名单 = username / xhs_id / solved_game_ids
--   - 白名单之外的列（role / id / updated_at）一律不由客户端写
--     （id 与 updated_at 由触发器 handle_profile_row() 自动写入；profiles 无 created_at 列）
--   - 普通用户只能读写 auth.uid() 对应的本人记录，禁止 DELETE
--   - 审核函数固定 search_path、以 profiles.role 做角色校验、仅 authenticated 可执行
--   - 不在本次范围：increment_game_views / games / game_stats / 各类 View / 缓存
--   - 整个迁移包在 BEGIN/COMMIT 中：任一语句失败 → 自动整体回滚（原子性）
--
-- ⚠️ 执行前，请先在 SQL Editor 跑【第 0 节 部署前预检】（只读），
--    确认线上审核函数输入参数名后再执行本迁移
--    （CREATE OR REPLACE 不能改参数名，否则报 "cannot change name of input parameter"）。
--
-- ⚠️ 部署要求（同一维护窗口内连续完成，不能分批）：
--   1) 先执行本迁移（创建触发器 + 收紧权限）；
--   2) 紧接着发布新前端（api.ts upsertProfile 已停止提交 id/updated_at）。
--   原因：
--     - 新前端依赖本迁移创建的触发器写入 id / updated_at；若迁移未执行就发前端，
--       注册写 profiles 会因缺 id 而失败；
--     - 旧前端会提交迁移已禁止写入的 id / updated_at（列权限拒绝）；
--       若迁移先执行而旧前端仍在线，注册同样会失败。
--   因此两者必须同一窗口、先后连续完成；迁移窗口内注册写入存在中断，
--   不能声称"无影响"。建议避开高峰并提前通告维护。
-- ============================================================

-- ==================== 0. 部署前预检（只读，先执行，确认后再跑本迁移） ====================

-- 目的：CREATE OR REPLACE FUNCTION 不能更改输入参数名，也不能更改返回类型；
--       本迁移第 4 节沿用线上现有签名（approve: sub_id integer / reject: sub_id integer,
--       reason text，返回 void），且【不 DROP 任何已有审核函数】。
--       请先核对线上结果与下列期望一致；若 input_args 不一致，按线上实际参数名
--       调整第 4 节的 CREATE OR REPLACE 签名及函数体内的参数引用。
SELECT p.proname,
       pg_get_function_arguments(p.oid)          AS input_args,
       pg_get_function_identity_arguments(p.oid) AS identity_args,
       pg_get_function_result(p.oid)             AS result_type
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('approve_submission','reject_submission');
-- 期望：
--   approve_submission → input_args: "sub_id integer"      （前端 RPC 参数名即 sub_id）
--   reject_submission  → input_args: "sub_id integer, reason text"
--   result_type        → 两者均为 void

BEGIN;

-- ==================== 1. profiles 列权限收敛 ====================

-- 1.1 撤销 authenticated / anon 的表级全部权限
--     （注意：表级 REVOKE 只清表级 ACL，清不掉历史列级授权 → 由 1.2 DO 块兜底）
REVOKE ALL ON TABLE public.profiles FROM authenticated;
REVOKE ALL ON TABLE public.profiles FROM anon;

-- 1.2 真正完成列级白名单收敛：
--     先撤销 authenticated / anon / PUBLIC 对 profiles【全部列】的 INSERT/UPDATE 列级权限。
--     列清单动态读取 information_schema（覆盖当前实际全部列，天然防 schema 漂移），
--     确保 role / id / updated_at 及其它任何非白名单列都没有残留写权限。
DO $$
DECLARE
  col TEXT;
  r   TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['authenticated', 'anon', 'public']
  LOOP
    FOR col IN
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles'
    LOOP
      EXECUTE format('REVOKE INSERT (%I) ON TABLE public.profiles FROM %s', col, r);
      EXECUTE format('REVOKE UPDATE (%I) ON TABLE public.profiles FROM %s', col, r);
    END LOOP;
  END LOOP;
END;
$$;

-- 1.3 保留读取：前端 fetchProfile（select=*）需要 SELECT，
--     行级范围由下方 RLS 策略限定为"只能读自己"
GRANT SELECT ON TABLE public.profiles TO authenticated;

-- 1.4 只授予前端实际写入的列（写白名单）
--     INSERT：注册时创建本人档案（id / updated_at 由触发器写入，不在列内）
GRANT INSERT (username, xhs_id) ON TABLE public.profiles TO authenticated;
--     UPDATE：改昵称 / 小红书 ID（upsertProfile）、标记已侦破进度（updateSolvedGames）
GRANT UPDATE (username, xhs_id, solved_game_ids) ON TABLE public.profiles TO authenticated;

-- 1.5 显式收回 role 列权限（DO 块已覆盖，此处保留作为 P0 意图的显式声明）
REVOKE INSERT (role) ON TABLE public.profiles FROM authenticated;
REVOKE UPDATE (role) ON TABLE public.profiles FROM authenticated;

-- ==================== 2. 触发器：自动写入 id / updated_at ====================

-- 2.1 触发器函数
--   普通 authenticated 请求（auth.uid() 非空）INSERT 时，强制以 auth.uid() 覆盖
--   NEW.id，防止伪造 / 借用他人档案 id；
--   service role / SQL Editor / 后台维护没有 auth.uid() 时，保留调用方显式提供的
--   NEW.id，保证管理员建号等后台场景不受影响。
--   INSERT / UPDATE 继续自动维护 updated_at（系统时间，客户端不可控）。
CREATE OR REPLACE FUNCTION public.handle_profile_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF (select auth.uid()) IS NOT NULL THEN
      NEW.id := (select auth.uid());
    END IF;
    -- auth.uid() 为 NULL（service role / SQL Editor / 后台）时保留显式 NEW.id；
    -- 若此时又未提供 id，主键约束会报错——这是预期护栏（不允许匿名建号）。
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- 2.2 收回对触发器函数的直接 EXECUTE（防止任何人绕过触发器逻辑直调该函数）
--     PostgreSQL 触发器由内核触发，不受 EXECUTE 权限约束；
--     本 REVOKE 只影响直接 SELECT handle_profile_row() 调用，不影响触发器工作。
REVOKE ALL ON FUNCTION public.handle_profile_row() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_profile_row() FROM anon;
REVOKE ALL ON FUNCTION public.handle_profile_row() FROM authenticated;

-- 2.3 幂等重建触发器（避免重复执行报 "already exists"）
DROP TRIGGER IF EXISTS trg_profiles_set_id_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_set_id_updated_at
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_row();

-- ==================== 3. profiles RLS ====================

-- 3.1 启用 RLS（若已是 on 无副作用）
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3.2 按精确名称删除线上已知的 5 条旧策略
--     （DROP POLICY IF EXISTS：即使某条在线不存在也不报错，保证幂等）
DROP POLICY IF EXISTS "anyone_can_read_profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "users_can_manage_own_profile" ON public.profiles;

-- 3.3 重建独立策略（最终只保留这 3 条；不用 FOR ALL；TO authenticated；
--      不用已弃用的 auth.role()）
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- 注意：不创建 DELETE 策略 → RLS 启用状态下，authenticated 对任何行都无法 DELETE

-- ==================== 4. 审核函数重建 + 权限收敛 ====================
-- 完整签名重建（仅 CREATE OR REPLACE，【不 DROP】已有函数；沿用线上输入参数名
-- sub_id / reason，见第 0 节预检）；SECURITY DEFINER 固定 search_path；角色校验
-- 以 profiles.role 为唯一权威（不依赖 user_metadata）；schema / 表 / 列全部显式
-- public. 限定。业务字段映射与旧逻辑保持一致，本次不改动。

CREATE OR REPLACE FUNCTION public.approve_submission(sub_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  sub RECORD;
  new_id integer;
BEGIN
  -- 权限校验：调用者必须是管理员或内容编辑（profiles.role 为唯一权威）
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'normal_admin')
  ) THEN
    RAISE EXCEPTION '无权限：仅管理员或内容编辑可审核';
  END IF;

  SELECT * INTO sub FROM public.game_submissions WHERE id = sub_id;
  IF sub IS NULL OR sub.status IS DISTINCT FROM '审核中' THEN
    RAISE EXCEPTION '投稿不存在或已处理';
  END IF;

  -- 自增 id（兼容手动录入）。
  -- ⚠️ 已知风险：MAX(id)+1 在并发审核时存在主键冲突可能，
  --    后续应改为 sequence / identity（见实施报告"尚未处理的风险"）。
  SELECT COALESCE(MAX(g.id), 0) + 1 INTO new_id FROM public.games g;

  -- 插入到 games
  INSERT INTO public.games (id, title, url, description, image_url, category, author_name, author_url, answer_url, tags)
  VALUES (
    new_id,
    sub.title,
    sub.url,
    sub.description,
    sub.image_url,
    ARRAY[sub.duration],
    sub.author_name,
    sub.author_url,
    sub.answer_url,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN sub.pc THEN 'PC' ELSE NULL END,
      CASE WHEN sub.pe THEN 'PE' ELSE NULL END,
      CASE WHEN sub.jumpscare THEN '有跳杀' ELSE NULL END,
      CASE WHEN sub.sound THEN '有声音' ELSE NULL END
    ], NULL)
  );

  -- 更新投稿状态
  UPDATE public.game_submissions SET status = '已通过', reviewed_at = NOW() WHERE id = sub_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_submission(sub_id integer, reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 权限校验：调用者必须是管理员或内容编辑（profiles.role 为唯一权威）
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (select auth.uid())
      AND p.role IN ('admin', 'normal_admin')
  ) THEN
    RAISE EXCEPTION '无权限：仅管理员或内容编辑可审核';
  END IF;

  UPDATE public.game_submissions
  SET status = '已驳回', review_comment = reason, reviewed_at = NOW()
  WHERE id = sub_id AND status = '审核中';

  IF NOT FOUND THEN
    RAISE EXCEPTION '投稿不存在或已处理';
  END IF;
END;
$$;

-- 权限收敛：撤销 PUBLIC / anon 的 EXECUTE，只允许 authenticated
REVOKE ALL ON FUNCTION public.approve_submission(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_submission(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_submission(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_submission(integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_submission(integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_submission(integer, text) TO authenticated;

COMMIT;

-- ============================================================
-- 迁移结束。
--
-- 以下为【只读验证 SQL】，迁移成功后另行单独执行（勿与本迁移同批执行）。
-- 全部为 SELECT / has_*_privilege 只读查询，不修改任何数据。
-- ============================================================

-- A. profiles 最终策略全景（pg_policies 视图直接取列：policyname / cmd / roles / qual / with_check）
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;
-- 期望：恰好 3 条 —— profiles_select_own / profiles_insert_own / profiles_update_own；
--       roles 均含 authenticated；qual / with_check 均为 ((select auth.uid()) = id)；
--       无 cmd = 'ALL'。

-- B. 策略数量断言：期望 = 3
SELECT count(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles';
-- 期望：3

-- C. profiles RLS 已启用（配合 A 中的 qual，即为"authenticated 只能读写自己的行"；
--    行级功能验证需用真实登录态客户端发请求复核）
SELECT c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'profiles';
-- 期望：true

-- D. anon 对 profiles 无表级权限
SELECT has_table_privilege('anon', 'public.profiles', 'SELECT') AS anon_select,
       has_table_privilege('anon', 'public.profiles', 'INSERT') AS anon_insert,
       has_table_privilege('anon', 'public.profiles', 'UPDATE') AS anon_update,
       has_table_privilege('anon', 'public.profiles', 'DELETE') AS anon_delete;
-- 期望：全 false

-- E. authenticated 对 profiles【全部列】的 INSERT/UPDATE 列级权限矩阵
--    （覆盖 role / id / updated_at 及其它一切非白名单列，确认无残留写权限）
SELECT column_name,
       has_column_privilege('authenticated', 'public.profiles', column_name, 'INSERT') AS can_insert,
       has_column_privilege('authenticated', 'public.profiles', column_name, 'UPDATE') AS can_update
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;
-- 期望（按线上实际列）：仅以下为 true，其余全 false：
--   username        → insert=true,  update=true
--   xhs_id          → insert=true,  update=true
--   solved_game_ids → insert=false, update=true
--   role / id / updated_at（及任何其它列）→ insert=false, update=false

-- F. anon 对 profiles 全部列也无写权限（纵深防御）
SELECT column_name,
       has_column_privilege('anon', 'public.profiles', column_name, 'INSERT') AS can_insert,
       has_column_privilege('anon', 'public.profiles', column_name, 'UPDATE') AS can_update
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;
-- 期望：全 false

-- G. 审核函数 ACL：应【仅】authenticated 有 EXECUTE
--    （grantee_oid = 0 表示 PUBLIC；用 aclexplode 展开 pg_proc.proacl）
SELECT p.proname,
       a.grantee       AS grantee_oid,   -- 0 = PUBLIC
       COALESCE(r.rolname, 'PUBLIC') AS grantee,
       a.privilege_type AS priv
FROM pg_proc p
CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
LEFT JOIN pg_roles r ON r.oid = a.grantee
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('approve_submission','reject_submission')
ORDER BY 1, 2, 3;
-- 期望：每个函数 1 行 —— grantee = authenticated、priv = EXECUTE；
--       无 PUBLIC(grantee_oid=0) 行、无 anon 行。

-- H. handle_profile_row ACL：应为空（PUBLIC / anon / authenticated 均不可直接执行；
--    触发器由内核调用，不受 EXECUTE 影响）
SELECT p.proname,
       a.grantee       AS grantee_oid,
       COALESCE(r.rolname, 'PUBLIC') AS grantee,
       a.privilege_type AS priv
FROM pg_proc p
CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
LEFT JOIN pg_roles r ON r.oid = a.grantee
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname = 'handle_profile_row';
-- 期望：0 行（ACL 为空 = 除函数 owner 外无人可直接执行）

-- I. 函数安全属性：SECURITY DEFINER + 固定 search_path + 参数名/返回类型
SELECT proname,
       prosecdef AS is_secdef,
       proconfig  AS settings,
       lanname    AS language,
       pg_get_function_arguments(oid)          AS input_args,
       pg_get_function_identity_arguments(oid) AS identity_args,
       pg_get_function_result(oid)             AS result_type
FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('approve_submission','reject_submission');
-- 期望：is_secdef = true；settings 含 {search_path=public,pg_temp}；
--      input_args：approve = "sub_id integer"、reject = "sub_id integer, reason text"；
--      result_type：两者均为 void

-- J. 新触发器定义正确
SELECT tgname,
       pg_get_triggerdef(oid) AS trigger_def
FROM pg_trigger
WHERE tgrelid = 'public.profiles'::regclass
  AND NOT tgisinternal;
-- 期望：trg_profiles_set_id_updated_at，BEFORE INSERT OR UPDATE ON public.profiles
