
ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS change_pct numeric(12,6),
  ADD COLUMN IF NOT EXISTS change_value_usd numeric(20,6),
  ADD COLUMN IF NOT EXISTS market_cap numeric(28,2),
  ADD COLUMN IF NOT EXISTS dividend_yield numeric(12,6),
  ADD COLUMN IF NOT EXISTS prev_close_usd numeric(20,6);

CREATE TABLE IF NOT EXISTS public.watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  asset_kind text NOT NULL DEFAULT 'STOCK',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist TO authenticated;
GRANT ALL ON public.watchlist TO service_role;

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own watchlist all" ON public.watchlist
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER watchlist_touch BEFORE UPDATE ON public.watchlist
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
