CREATE TABLE public.license_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  license_key TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.license_redemptions TO authenticated;
GRANT ALL ON public.license_redemptions TO service_role;
ALTER TABLE public.license_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own redemption read" ON public.license_redemptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
