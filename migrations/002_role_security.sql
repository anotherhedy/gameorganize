-- ============================================================
-- 迁移：管理员权限安全加固
-- 1) 禁止普通用户自写 profiles.role（防提权为超管）
-- 2) 审核 RPC 加角色校验（防任何用户绕过审核）
-- 3) 迁移旧版 user_metadata.role 管理员到 profiles.role
--
-- ⚠️ 执行方式：登录 Supabase Dashboard → SQL Editor → 粘贴整段执行
-- ⚠️ 需与前端代码同时上线：前端注册时不再传 role（见 AuthModal.tsx）
-- ============================================================

-- ---- 1. 防提权：authenticated 角色不能写 role 列 ----
-- 先兜底默认值：注册时前端不再传 role，由数据库默认 'user'
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'user';
UPDATE profiles SET role = 'user' WHERE role IS NULL OR role = '';

-- 列级权限：登录用户（authenticated）无法 INSERT / UPDATE role 列
--  * service_role 密钥（服务端 CF Function）不受影响 → 管理员改角色仍可用
--  * SECURITY DEFINER 函数不受列级权限限制
REVOKE INSERT (role) ON profiles FROM authenticated;
REVOKE UPDATE (role) ON profiles FROM authenticated;

-- 说明：若 profiles 表当前未启用 RLS（dashboard 中 relrowsecurity=false），
-- 建议一并执行下面两行（启用行级安全；若已有策略不受影响，若无策略将默认全禁）：
--   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
--   （并用 dashboard 可视化界面补回 SELECT 自己 + UPDATE 自己的策略）

-- ---- 2. 审核 RPC 加角色校验（仅 admin / normal_admin 可审核）----
CREATE OR REPLACE FUNCTION approve_submission(sub_id INT)
RETURNS VOID AS $$
DECLARE
  sub RECORD;
  new_id INT;
BEGIN
  -- 权限校验：调用者必须是管理员或内容编辑（auth.uid() 读取当前登录用户）
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'normal_admin')
  ) THEN
    RAISE EXCEPTION '无权限：仅管理员或内容编辑可审核';
  END IF;

  SELECT * INTO sub FROM game_submissions WHERE id = sub_id;
  IF sub IS NULL OR sub.status != '审核中' THEN
    RAISE EXCEPTION '投稿不存在或已处理';
  END IF;

  -- 自增 id（兼容手动录入）
  SELECT COALESCE(MAX(id::int), 0) + 1 INTO new_id FROM games;

  -- 插入到 games
  INSERT INTO games (id, title, url, description, image_url, category, author_name, author_url, answer_url, tags)
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
  UPDATE game_submissions SET status = '已通过', reviewed_at = NOW() WHERE id = sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reject_submission(sub_id INT, reason TEXT)
RETURNS VOID AS $$
BEGIN
  -- 权限校验：调用者必须是管理员或内容编辑
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'normal_admin')
  ) THEN
    RAISE EXCEPTION '无权限：仅管理员或内容编辑可审核';
  END IF;

  UPDATE game_submissions
  SET status = '已驳回', review_comment = reason, reviewed_at = NOW()
  WHERE id = sub_id AND status = '审核中';

  IF NOT FOUND THEN
    RAISE EXCEPTION '投稿不存在或已处理';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 限制执行权限：只允许登录用户调用（默认是 PUBLIC 都可调用）
REVOKE ALL ON FUNCTION approve_submission(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_submission(INT) TO authenticated;
REVOKE ALL ON FUNCTION reject_submission(INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reject_submission(INT, TEXT) TO authenticated;

-- ---- 3. 迁移旧版 metadata 管理员到 profiles.role ----
-- 老版本曾在 auth.users.raw_user_meta_data 里存 role='admin'，
-- 新代码以 profiles.role 为唯一权威，这里一次性搬过去。
UPDATE profiles p
SET role = 'admin'
FROM auth.users u
WHERE p.id = u.id
  AND u.raw_user_meta_data->>'role' = 'admin'
  AND p.role NOT IN ('admin', 'normal_admin');
