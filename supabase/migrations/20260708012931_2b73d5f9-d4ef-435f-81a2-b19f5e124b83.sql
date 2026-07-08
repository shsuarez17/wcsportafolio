
-- 1) Tighten access_codes RLS: remove the two overly-permissive policies.
DROP POLICY IF EXISTS "authenticated read unused codes" ON public.access_codes;
DROP POLICY IF EXISTS "user redeem unused code" ON public.access_codes;
-- Redemption now happens exclusively via the server function using the service role,
-- which authenticates the user via requireSupabaseAuth before claiming a code.
-- Remaining policies: admins read all; users read only their own claimed code.

-- 2) Move has_role out of the exposed public schema so it is no longer directly
-- callable by signed-in users via the Data API / PostgREST.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Repoint existing policies to the private function
DROP POLICY IF EXISTS "admins read all codes" ON public.access_codes;
CREATE POLICY "admins read all codes" ON public.access_codes
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- Drop the public wrapper so it's no longer exposed via the Data API.
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
