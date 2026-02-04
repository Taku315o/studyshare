-- Remove admin-based policies on users to avoid RLS recursion
DROP POLICY IF EXISTS "admin delete users" ON "public"."users";
DROP POLICY IF EXISTS "select self or admin" ON "public"."users";
DROP POLICY IF EXISTS "update self or admin" ON "public"."users";

-- Self-only access policies
CREATE POLICY "select self only"
ON "public"."users"
FOR SELECT
USING ("auth"."uid"() = "id");

CREATE POLICY "update self only"
ON "public"."users"
FOR UPDATE
USING ("auth"."uid"() = "id")
WITH CHECK ("auth"."uid"() = "id");
