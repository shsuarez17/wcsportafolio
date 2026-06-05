import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { fmtUSD, fmtPct } from "@/lib/format";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, Legend,
} from "recharts";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/analytics")({ component: AnalyticsPage });

const COLORS = ["#22c55e", "#3b82f6", "#a855f7", "#f59e0b", "#ec4899", "#06b6d4", "#84cc16", "#ef4444", "#8b5cf6", "#14b8a6"];

function typeBucket(t: string) {
  if (t === "CRYPTO") return "Cripto";
  if (t === "ETF") return "ETF";
  if (t === "BOND") return "Bonos";
  if (t === "STOCK_US" || t === "STOCK_CO") return "Acciones";
  return "Personalizado";
}

export default function AnalyticsPage() {
  const holdingsQ = useQuery({
    queryKey: ["investments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("investments").select("*").order("purchase_date");
      if (error) throw error;
      return data ?? [];
    },
  });
  const holdings = holdingsQ.data ?? [];

  // 1. Evolución portfolio: invertido acumulado por fecha de compra
  const evolution = useMemo(() => {
    const map = new Map<string, number>();
    [...holdings]
      .sort((a, b) => (a.purchase_date as string).localeCompare(b.purchase_date as string))
      .forEach((h: any) => {
        const inv = Number(h.quantity) * Number(h.avg_cost_usd);
        const key = h.purchase_date as string;
        map.set(key, (map.get(key) ?? 0) + inv);
      });
    let cum = 0;
    return Array.from(map.entries()).map(([date, v]) => {
      cum += v;
      return { date, invested: cum };
    });
  }, [holdings]);

  // 2. Distribución por activo (% sobre valor actual)
  const distribution = useMemo(() => {
    const byName = new Map<string, number>();
    holdings.forEach((h: any) => {
      const v = Number(h.quantity) * Number(h.current_price_usd || h.avg_cost_usd);
      byName.set(h.name, (byName.get(h.name) ?? 0) + v);
    });
    return Array.from(byName.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [holdings]);

  // 3. Distribución por clase
  const byClass = useMemo(() => {
    const map = new Map<string, number>();
    holdings.forEach((h: any) => {
      const v = Number(h.quantity) * Number(h.current_price_usd || h.avg_cost_usd);
      const k = typeBucket(h.asset_type);
      map.set(k, (map.get(k) ?? 0) + v);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [holdings]);

  // 4. Rentabilidad mensual: ΔInvertido acumulado mes a mes
  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    holdings.forEach((h: any) => {
      const inv = Number(h.quantity) * Number(h.avg_cost_usd);
      const ym = (h.purchase_date as string).slice(0, 7);
      map.set(ym, (map.get(ym) ?? 0) + inv);
    });
    return Array.from(map.entries()).sort().map(([month, value]) => ({ month, value }));
  }, [holdings]);

  // 5. P&L por activo
  const pnl = useMemo(() => {
    const map = new Map<string, { name: string; invested: number; current: number }>();
    holdings.forEach((h: any) => {
      const inv = Number(h.quantity) * Number(h.avg_cost_usd);
      const cur = Number(h.quantity) * Number(h.current_price_usd || h.avg_cost_usd);
      const e = map.get(h.name) ?? { name: h.name, invested: 0, current: 0 };
      e.invested += inv; e.current += cur;
      map.set(h.name, e);
    });
    return Array.from(map.values())
      .map((e) => ({ name: e.name, pnl: e.current - e.invested, pct: e.invested ? (e.current - e.invested) / e.invested : 0 }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [holdings]);

  // 6. Dividendos: yield × valor actual
  const dividends = useMemo(() => {
    const items = holdings
      .map((h: any) => {
        const dy = Number(h.dividend_yield ?? 0);
        const val = Number(h.quantity) * Number(h.current_price_usd || h.avg_cost_usd);
        const annual = val * dy;
        return { name: h.name, ticker: h.ticker, yield: dy, value: val, annual };
      })
      .filter((i) => i.annual > 0)
      .sort((a, b) => b.annual - a.annual);
    const annual = items.reduce((a, b) => a + b.annual, 0);
    return { items, annual, monthly: annual / 12 };
  }, [holdings]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">Analítica</h1>
        <p className="text-sm text-muted-foreground">Evolución, distribución, rentabilidad y dividendos.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Evolución (invertido acumulado USD)</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={evolution}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1f2937" }} formatter={(v: any) => fmtUSD(Number(v))} />
                <Area type="monotone" dataKey="invested" stroke="#22c55e" fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-2">Distribución por clase</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byClass} dataKey="value" nameKey="name" outerRadius={90} label={(d: any) => `${d.name} ${fmtPct(d.value / (byClass.reduce((a, b) => a + b.value, 0) || 1))}`}>
                  {byClass.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1f2937" }} formatter={(v: any) => fmtUSD(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-2">Distribución por activo</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={distribution.slice(0, 10)} dataKey="value" nameKey="name" outerRadius={90}>
                  {distribution.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1f2937" }} formatter={(v: any) => fmtUSD(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-2">Inversión mensual</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1f2937" }} formatter={(v: any) => fmtUSD(Number(v))} />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">Ganancia / Pérdida por activo</h3>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={pnl.slice(0, 15)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1f2937" }} formatter={(v: any) => fmtUSD(Number(v))} />
              <Bar dataKey="pnl">
                {pnl.slice(0, 15).map((d, i) => (
                  <Cell key={i} fill={d.pnl >= 0 ? "#22c55e" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">Dividendos (estimación Yahoo)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <Stat label="Anual estimado" value={fmtUSD(dividends.annual)} />
          <Stat label="Mensual estimado" value={fmtUSD(dividends.monthly)} />
          <Stat label="Activos con dividendo" value={String(dividends.items.length)} />
        </div>
        {dividends.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay datos de dividendos. Pulsa "Actualizar precios" en el dashboard para traerlos desde Yahoo.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-xs">
                <tr><th className="text-left p-2">Activo</th><th className="text-right p-2">Yield</th><th className="text-right p-2">Valor</th><th className="text-right p-2">Ingreso anual</th></tr>
              </thead>
              <tbody>
                {dividends.items.map((i) => (
                  <tr key={i.ticker + i.name} className="border-t border-border">
                    <td className="p-2">{i.name} <span className="text-muted-foreground font-mono text-xs">{i.ticker}</span></td>
                    <td className="p-2 text-right tabular font-mono">{fmtPct(i.yield)}</td>
                    <td className="p-2 text-right tabular font-mono">{fmtUSD(i.value)}</td>
                    <td className="p-2 text-right tabular font-mono text-emerald-500">{fmtUSD(i.annual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-bold">{value}</p>
    </div>
  );
}