import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type YahooQuote = {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePct: number;
  marketCap: number | null;
  currency: string;
  dividendYield: number | null;
  shortName: string | null;
};

// Map a user ticker + asset_type to a Yahoo Finance symbol.
// Crypto goes through Yahoo (e.g. BTC -> BTC-USD) so we get a single uniform source.
export function toYahooSymbol(ticker: string, assetType?: string): string {
  const t = ticker.trim().toUpperCase();
  if (!t) return t;
  if (assetType === "CRYPTO" && !t.includes("-")) return `${t}-USD`;
  return t;
}

async function fetchYahooQuotes(symbols: string[]): Promise<Record<string, YahooQuote>> {
  const out: Record<string, YahooQuote> = {};
  const unique = Array.from(new Set(symbols.filter(Boolean)));
  if (!unique.length) return out;
  // chart endpoint per-symbol (more reliable than the /v7/quote endpoint which is often blocked)
  await Promise.all(unique.map(async (s) => {
    try {
      const r = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=5d`,
        { headers: { "User-Agent": "Mozilla/5.0" } },
      );
      if (!r.ok) return;
      const j = await r.json() as any;
      const meta = j?.chart?.result?.[0]?.meta;
      if (!meta || typeof meta.regularMarketPrice !== "number") return;
      const price = Number(meta.regularMarketPrice);
      const prev = Number(
        meta.chartPreviousClose ?? meta.previousClose ?? price
      );
      out[s.toUpperCase()] = {
        symbol: s.toUpperCase(),
        price,
        previousClose: prev,
        change: price - prev,
        changePct: prev ? (price - prev) / prev : 0,
        marketCap: null,
        currency: meta.currency ?? "USD",
        dividendYield: null,
        shortName: meta.shortName ?? meta.longName ?? null,
      };
    } catch { /* ignore */ }
  }));

  // enrich with marketCap + dividendYield via quoteSummary
  await Promise.all(Object.keys(out).map(async (sym) => {
    try {
      const r = await fetch(
        `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=summaryDetail,price`,
        { headers: { "User-Agent": "Mozilla/5.0" } },
      );
      if (!r.ok) return;
      const j = await r.json() as any;
      const res = j?.quoteSummary?.result?.[0];
      const mcap = res?.price?.marketCap?.raw ?? res?.summaryDetail?.marketCap?.raw ?? null;
      const dy = res?.summaryDetail?.dividendYield?.raw
        ?? res?.summaryDetail?.trailingAnnualDividendYield?.raw
        ?? null;
      if (typeof mcap === "number") out[sym].marketCap = mcap;
      if (typeof dy === "number") out[sym].dividendYield = dy;
    } catch { /* ignore */ }
  }));

  return out;
}

async function fetchUsdCop(): Promise<number> {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    if (r.ok) {
      const j = await r.json() as any;
      const rate = j?.rates?.COP;
      if (typeof rate === "number" && rate > 0) return rate;
    }
  } catch { /* ignore */ }
  // fallback
  return 4000;
}

export const refreshPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: holdings, error } = await supabase
      .from("investments")
      .select("id,ticker,asset_type")
      .eq("user_id", userId);
    if (error) throw error;

    const symbolByHolding = (holdings ?? []).map((h) => ({
      id: h.id,
      sym: toYahooSymbol(h.ticker, h.asset_type as string),
    }));
    const quotes = await fetchYahooQuotes(symbolByHolding.map((s) => s.sym));
    const fx = await fetchUsdCop();
    const now = new Date().toISOString();
    let updated = 0;
    await Promise.all(symbolByHolding.map(async (h) => {
      const q = quotes[h.sym.toUpperCase()];
      if (!q) return;
      updated++;
      await supabase.from("investments").update({
        current_price_usd: q.price,
        prev_close_usd: q.previousClose,
        change_value_usd: q.change,
        change_pct: q.changePct,
        market_cap: q.marketCap,
        currency: q.currency || "USD",
        dividend_yield: q.dividendYield,
        price_updated_at: now,
      }).eq("id", h.id);
    }));
    return { updated, fx_usd_cop: fx };
  });

export const getFxUsdCop = createServerFn({ method: "GET" })
  .handler(async () => {
    return { rate: await fetchUsdCop() };
  });

export const searchTicker = createServerFn({ method: "POST" })
  .inputValidator((d: { query: string; type: "CRYPTO" | "STOCK" }) =>
    z.object({ query: z.string().min(1).max(20), type: z.enum(["CRYPTO", "STOCK"]) }).parse(d))
  .handler(async ({ data }) => {
    const r = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(data.query)}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!r.ok) return { results: [] };
    const j = await r.json() as any;
    return { results: (j?.quotes ?? []).slice(0, 8).map((q: any) => ({ symbol: q.symbol, name: q.shortname ?? q.longname ?? q.symbol })) };
  });

// Fetch live quotes for an arbitrary list of Yahoo symbols (used by watchlist UI).
export const quoteSymbols = createServerFn({ method: "POST" })
  .inputValidator((d: { symbols: string[] }) =>
    z.object({ symbols: z.array(z.string().min(1).max(15)).max(50) }).parse(d))
  .handler(async ({ data }) => {
    const quotes = await fetchYahooQuotes(data.symbols.map((s) => s.toUpperCase()));
    return { quotes };
  });
