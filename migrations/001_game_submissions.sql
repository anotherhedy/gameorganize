-- ============================================================
-- 迁移：独立的投稿审核表 + 清理 games 表
-- 之前投稿直接写入 games 表（status='审核中'），污染主数据
-- 现在拆分为 game_submissions（投稿队列）和 games（已通过的游戏）
-- ============================================================

-- 1. 创建投稿表
CREATE TABLE IF NOT EXISTS game_submissions (
  id        SERIAL PRIMARY KEY,
  title     TEXT NOT NULL,
  url       TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  duration  TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_url TEXT NOT NULL,
  answer_url TEXT,
  pc        BOOLEAN DEFAULT true,
  pe        BOOLEAN DEFAULT false,
  jumpscare BOOLEAN DEFAULT false,
  sound     BOOLEAN DEFAULT false,
  submitted_by UUID REFERENCES auth.users(id),
  status    TEXT DEFAULT '审核中',   -- 审核中 / 已通过 / 已驳回
  review_comment TEXT,               -- 驳回原因
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- 2. RLS 策略
ALTER TABLE game_submissions ENABLE ROW LEVEL SECURITY;

-- 所有人可读（查重用）
CREATE POLICY "允许所有人读取投稿" ON game_submissions
  FOR SELECT USING (true);

-- 登录用户可投稿
CREATE POLICY "允许登录用户投稿" ON game_submissions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 3. 管理员 RPC（SECURITY DEFINER 绕过 RLS）
-- 通过投稿：插入 games + 更新 submission 状态
CREATE OR REPLACE FUNCTION approve_submission(sub_id INT)
RETURNS VOID AS $$
DECLARE
  sub RECORD;
  new_id INT;
BEGIN
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

-- 驳回投稿
CREATE OR REPLACE FUNCTION reject_submission(sub_id INT, reason TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE game_submissions
  SET status = '已驳回', review_comment = reason, reviewed_at = NOW()
  WHERE id = sub_id AND status = '审核中';

  IF NOT FOUND THEN
    RAISE EXCEPTION '投稿不存在或已处理';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 清理 games 表旧字段（之前投稿流程遗留）
ALTER TABLE games DROP COLUMN IF EXISTS status;
ALTER TABLE games DROP COLUMN IF EXISTS submitted_by;
ALTER TABLE games DROP COLUMN IF EXISTS review_comment;
