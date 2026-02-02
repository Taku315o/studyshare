drop trigger if exists "update_users_updated_at" on "public"."users";

drop policy "自分の課題のみ削除可能または管理者" on "public"."assignments";

drop policy "自分の課題のみ更新可能" on "public"."assignments";

drop policy "認証済みユーザーのみ課題を投稿可能" on "public"."assignments";

drop policy "課題は全員閲覧可能" on "public"."assignments";

drop policy "ユーザーは自分のプロフィールを閲覧可能" on "public"."users";

alter table "public"."assignments" add column "updated_at" timestamp with time zone not null default now();

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = uid AND u.role = 'admin'
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_role_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  INSERT INTO public.users (id, email, role, created_at, updated_at)
  VALUES (new.id, new.email, 'student', now(), now());
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.search_assignments(search_query text)
 RETURNS SETOF public.assignments
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;


  create policy "assignments delete own or admin"
  on "public"."assignments"
  as permissive
  for delete
  to public
using (((auth.uid() = user_id) OR public.is_admin(auth.uid())));



  create policy "assignments insert authenticated"
  on "public"."assignments"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "assignments select all"
  on "public"."assignments"
  as permissive
  for select
  to public
using (true);



  create policy "assignments update own or admin"
  on "public"."assignments"
  as permissive
  for update
  to public
using (((auth.uid() = user_id) OR public.is_admin(auth.uid())))
with check (((auth.uid() = user_id) OR public.is_admin(auth.uid())));



  create policy "admin delete users"
  on "public"."users"
  as permissive
  for delete
  to public
using (public.is_admin(auth.uid()));



  create policy "insert self as student only"
  on "public"."users"
  as permissive
  for insert
  to public
with check (((id = auth.uid()) AND (role = 'student'::text)));



  create policy "select self or admin"
  on "public"."users"
  as permissive
  for select
  to public
using (((auth.uid() = id) OR public.is_admin(auth.uid())));



  create policy "update self or admin"
  on "public"."users"
  as permissive
  for update
  to public
using (((auth.uid() = id) OR public.is_admin(auth.uid())))
with check (((auth.uid() = id) OR public.is_admin(auth.uid())));


CREATE TRIGGER trg_assignments_touch BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_users_prevent_role_change BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.prevent_role_change();

CREATE TRIGGER trg_users_touch BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


  create policy "delete own or admin (assignments)"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'assignments'::text) AND ((owner = auth.uid()) OR public.is_admin(auth.uid()))));



  create policy "read all in assignments"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'assignments'::text));



  create policy "upload authenticated sets owner"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'assignments'::text) AND (owner = auth.uid())));



