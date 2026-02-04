-- ========================
-- 0) 事前：依存を消す（再構築前提）
-- ========================
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ========================
-- 1) users テーブル（email ）
-- ========================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at 自動更新（汎用）
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_touch ON public.users;
CREATE TRIGGER trg_users_touch
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE PROCEDURE public.touch_updated_at();

-- ========================
-- 2) admin 判定関数
-- ========================

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE plpgsql -- plpgsql に変更
SECURITY DEFINER -- RLSをバイパスして判定するために必要
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = uid AND u.role = 'admin'
  );
END;
$$;

-- ========================
-- 3) role変更禁止（非adminはroleを変えられない）
--   ※RLSだけで「roleを変えない」を厳密にやるのは難しいのでトリガーで強制
-- ========================
CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 管理者はOK
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- 非管理者は role 変更を禁止
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role change is not allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_prevent_role_change ON public.users;
CREATE TRIGGER trg_users_prevent_role_change
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE PROCEDURE public.prevent_role_change();

-- ========================
-- 4) users RLS
-- ========================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 参照：自分 or admin
DROP POLICY IF EXISTS "select self or admin" ON public.users;
CREATE POLICY "select self or admin" ON public.users
  FOR SELECT
  USING (auth.uid() = id OR public.is_admin(auth.uid()));

-- 更新：自分 or admin（role変更はトリガーで弾く）
DROP POLICY IF EXISTS "update self or admin" ON public.users;
CREATE POLICY "update self or admin" ON public.users
  FOR UPDATE
  USING (auth.uid() = id OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = id OR public.is_admin(auth.uid()));

-- 追加：自分の行のみ & role は student 固定
DROP POLICY IF EXISTS "insert self as student only" ON public.users;
CREATE POLICY "insert self as student only" ON public.users
  FOR INSERT
  WITH CHECK (id = auth.uid() AND role = 'student');

-- 削除：admin のみ
DROP POLICY IF EXISTS "admin delete users" ON public.users;
CREATE POLICY "admin delete users" ON public.users
  FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ========================
-- 5) Auth → public.users 自動挿入トリガー（emailもコピー）
-- ========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.users (id, email, role, created_at, updated_at)
  VALUES (new.id, new.email, 'student', now(), now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ========================
-- 6) assignments テーブル
-- ========================
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  user_id UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_assignments_touch ON public.assignments;
CREATE TRIGGER trg_assignments_touch
BEFORE UPDATE ON public.assignments
FOR EACH ROW EXECUTE PROCEDURE public.touch_updated_at();

-- ========================
-- 7) assignments RLS
-- ========================
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignments select all" ON public.assignments;
CREATE POLICY "assignments select all" ON public.assignments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "assignments insert authenticated" ON public.assignments;
CREATE POLICY "assignments insert authenticated" ON public.assignments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "assignments update own or admin" ON public.assignments;
CREATE POLICY "assignments update own or admin" ON public.assignments
  FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "assignments delete own or admin" ON public.assignments;
CREATE POLICY "assignments delete own or admin" ON public.assignments
  FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- ========================
-- 8) Storage bucket + policies（衝突回避のためDROPしてから作る）
-- ========================
INSERT INTO storage.buckets (id, name, public)
VALUES ('assignments', 'assignments', true)
ON CONFLICT (id) DO NOTHING;

-- 既存ポリシーと名前が被るとCREATE POLICYで死ぬので、必要なら全部落とす
DROP POLICY IF EXISTS "read all in assignments" ON storage.objects;
DROP POLICY IF EXISTS "upload authenticated sets owner" ON storage.objects;
DROP POLICY IF EXISTS "delete own or admin (assignments)" ON storage.objects;

-- 読み取りは全員
CREATE POLICY "read all in assignments" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'assignments');

-- アップロードは認証済み & ownerが自分
CREATE POLICY "upload authenticated sets owner" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'assignments' AND owner = auth.uid());

-- 削除は自分 or admin
CREATE POLICY "delete own or admin (assignments)" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'assignments'
    AND (owner = auth.uid() OR public.is_admin(auth.uid()))
  );

-- ========================
-- 9) 検索用インデックスと関数
-- ========================
CREATE INDEX assignments_title_description_idx
ON public.assignments
USING GIN (to_tsvector('simple', title || ' ' || description));

CREATE OR REPLACE FUNCTION public.search_assignments(search_query TEXT)
RETURNS SETOF public.assignments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.assignments
  WHERE
    to_tsvector('simple', title || ' ' || description) @@ plainto_tsquery('simple', search_query)
    OR title ILIKE '%' || search_query || '%'
    OR description ILIKE '%' || search_query || '%'
  ORDER BY created_at DESC;
END;
$$;


