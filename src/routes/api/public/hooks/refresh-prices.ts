import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchYahooQuotesAdmin } from "@/lib/prices.server";
import { toYahooSymbol } from "@/lib/prices.functions";

export const Route = createFileRoute("/api/public/hooks/refresh-prices")({
  server: {
    handlers: {
      POST: async () => {
        const { data: holdings, error } = await supabaseAdmin
          .from("investments")
          .select("id,ticker,asset_type");
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
        }
        const symbolByHolding = (holdings ?? []).map((h) => ({
          id: h.id,
          sym: toYahooSymbol(h.ticker, h.asset_type as string),
        }));
        const quotes = await fetchYahooQuotesAdmin(symbolByHolding.map((s) => s.sym));
        const now = new Date().toISOString();
        let updated = 0;
        for (const h of symbolByHolding) {
          const q = quotes[h.sym.toUpperCase()];
          if (!q) continue;
          updated++;
          await supabaseAdmin.from("investments").update({
            current_price_usd: q.price,
            prev_close_usd: q.previousClose,
            change_value_usd: q.change,
            change_pct: q.changePct,
            market_cap: q.marketCap,
            currency: q.currency || "USD",
            dividend_yield: q.dividendYield,
            price_updated_at: now,
          }).eq("id", h.id);
        }
        return new Response(JSON.stringify({ ok: true, updated, total: symbolByHolding.length }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});