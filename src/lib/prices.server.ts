// Server-only helpers reusable by both auth'd serverFns and public cron routes.
export type YahooQuoteRaw = {
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

export async function fetchYahooQuotesAdmin(symbols: string[]): Promise<Record<string, YahooQuoteRaw>> {
  const out: Record<string, YahooQuoteRaw> = {};
  const unique = Array.from(new Set(symbols.filter(Boolean)));
  if (!unique.length) return out;
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
      const prev = Number(meta.chartPreviousClose ?? meta.previousClose ?? price);
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