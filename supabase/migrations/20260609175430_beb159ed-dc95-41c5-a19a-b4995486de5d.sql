
CREATE TABLE public.saved_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  "interval" TEXT NOT NULL,
  price NUMERIC,
  change_pct NUMERIC,
  analysis_type TEXT NOT NULL DEFAULT 'technical',
  prompt TEXT,
  result TEXT NOT NULL,
  ai_model TEXT NOT NULL DEFAULT 'gemini',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_analyses TO authenticated;
GRANT ALL ON public.saved_analyses TO service_role;

ALTER TABLE public.saved_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own analyses"
  ON public.saved_analyses
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX saved_analyses_user_created_idx
  ON public.saved_analyses (user_id, created_at DESC);

CREATE TRIGGER saved_analyses_set_updated_at
  BEFORE UPDATE ON public.saved_analyses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
