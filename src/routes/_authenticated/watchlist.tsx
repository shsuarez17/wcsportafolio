import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listWatchlist, addWatchlistItem, deleteWatchlistItem } from "@/lib/watchlist.functions";
import { quoteSymbols, toYahooSymbol } from "@/lib/prices.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Trash2, Plus, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { fmtUSD, fmtPct } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/watchlist")({ component: WatchlistPage });

function WatchlistPage() {
  const qc = useQueryClient();
  const list = useServerFn(listWatchlist);
  const add = useServerFn(addWatchlistItem);
  const del = useServerFn(deleteWatchlistItem);
  const quote = useServerFn(quoteSymbols);

  const [hasSession, setHasSession] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setHasSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const wlQ = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => list(),
    enabled: hasSession === true,
  });
  const items = wlQ.data?.items ?? [];

  const symbols = useMemo(
    () => items.map((i: any) => toYahooSymbol(i.symbol, i.asset_kind === "CRYPTO" ? "CRYPTO" : "")),
    [items],
  );

  const quotesQ = useQuery({
    queryKey: ["watchlist-quotes", symbols.join(",")],
    queryFn: () => quote({ data: { symbols } }),
    enabled: symbols.length > 0,
    refetchInterval: 60_000,
  });
  const quotes = quotesQ.data?.quotes ?? {};

  const [symbol, setSymbol] = useState("");
  const [kind, setKind] = useState("STOCK");

  const addMut = useMutation({
    mutationFn: () => add({ data: { symbol: symbol.trim().toUpperCase(), asset_kind: kind } }),
    onSuccess: () => {
      setSymbol("");
      qc.invalidateQueries({ queryKey: ["watchlist"] });
      toast.success("Añadido");
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  return (
    <div className="space-y-6">
      {hasSession === false && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/5 text-sm">
          Modo administrador sin sesión: la watchlist requiere iniciar sesión para guardar símbolos. Inicia sesión para usar esta función.
        </Card>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Watchlist</h1>
          <p className="text-sm text-muted-foreground">Sigue cualquier símbolo de Yahoo Finance (AAPL, BTC-USD, ^GSPC).</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => quotesQ.refetch()}>
          <RefreshCw className={`size-4 mr-2 ${quotesQ.isFetching ? "animate-spin" : ""}`} /> Actualizar
        </Button>
      </div>

      <Card className="p-4 flex flex-col md:flex-row gap-2">
        <Input
          placeholder="Símbolo (ej: AAPL, BTC-USD, ^GSPC, VOO)"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && symbol.trim()) addMut.mutate(); }}
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="bg-background border border-border rounded-md px-3 text-sm"
        >
          <option value="STOCK">Acción / ETF</option>
          <option value="CRYPTO">Cripto</option>
          <option value="INDEX">Índice</option>
        </select>
        <Button onClick={() => addMut.mutate()} disabled={!symbol.trim() || addMut.isPending}>
          <Plus className="size-4 mr-1" /> Añadir
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Símbolo</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Cambio</TableHead>
              <TableHead className="text-right">% día</TableHead>
              <TableHead className="text-right">Cap. mercado</TableHead>
              <TableHead className="text-right">Div. yield</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Aún no tienes símbolos en seguimiento.</TableCell></TableRow>
            )}
            {items.map((i: any) => {
              const sym = toYahooSymbol(i.symbol, i.asset_kind === "CRYPTO" ? "CRYPTO" : "");
              const q = quotes[sym.toUpperCase()];
              const up = (q?.changePct ?? 0) >= 0;
              return (
                <TableRow key={i.id}>
                  <TableCell className="font-mono font-semibold">{sym}</TableCell>
                  <TableCell className="text-muted-foreground truncate max-w-[200px]">{q?.shortName ?? "—"}</TableCell>
                  <TableCell className="text-right tabular font-mono">{q ? fmtUSD(q.price) : "—"}</TableCell>
                  <TableCell className={`text-right tabular font-mono ${up ? "text-emerald-500" : "text-red-500"}`}>
                    {q ? `${up ? "+" : ""}${q.change.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className={`text-right tabular font-mono ${up ? "text-emerald-500" : "text-red-500"}`}>
                    {q ? (<span className="inline-flex items-center gap-1">{up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{fmtPct(q.changePct)}</span>) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular font-mono text-muted-foreground">{q?.marketCap ? fmtCompact(q.marketCap) : "—"}</TableCell>
                  <TableCell className="text-right tabular font-mono text-muted-foreground">{q?.dividendYield ? fmtPct(q.dividendYield) : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => delMut.mutate(i.id)} aria-label="Eliminar">
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function fmtCompact(n: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(n);
}