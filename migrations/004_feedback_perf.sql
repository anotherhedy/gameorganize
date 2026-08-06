-- ============================================================
-- 迁移：情报墙性能优化
-- 情报墙按 created_at DESC 排序分页，此前无索引 → 每次翻页全表排序。
-- 该索引让 ORDER BY created_at DESC 直接走索引，大幅降低翻页耗时。
-- 与前端 api.ts 的 count=estimated 配套生效。
--
-- ⚠️ 执行方式：登录 Supabase Dashboard → SQL Editor → 粘贴整段执行
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_feedback_created_at
  ON feedback (created_at DESC);
