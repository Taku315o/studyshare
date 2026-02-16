-- Auth → public.users 自動挿入トリガーのrole取得を拡張
-- raw_user_meta_data と raw_app_meta_data のどちらにもroleがあれば採用する
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(
      new.raw_user_meta_data->>'role',
      new.raw_app_meta_data->>'role',
      'student'
    )
  );
  RETURN NEW;
END;
$$;
