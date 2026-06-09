import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, Trash2, LayoutGrid, Square, Star, TrendingUp, TrendingDown, Newspaper } from "lucide-react";

export const Route = createFileRoute("/_authenticated/marketpulse")({
  component: MarketPulsePage,
});

// ---------- Design tokens (Bloomberg-inspired) ----------
const C = {
  bg: "#0D1117",
  surface: "#161B22",
  border: "#30363D",
  accent: "#2196F3",
  up: "#26A69A",
  down: "#EF5350",
  text: "#E6EDF3",
  muted: "#8B949E",
};

type WatchItem = { symbol: string; label: string; kind: "crypto" | "stock" | "forex" };

const DEFAULT_WATCH: WatchItem[] = [
  { symbol: "BINANCE:BTCUSDT", label: "BTC/USDT", kind: "crypto" },
  { symbol: "BINANCE:ETHUSDT", label: "ETH/USDT", kind: "crypto" },
  { symbol: "NASDAQ:AAPL", label: "AAPL", kind: "stock" },
];

const INTERVALS: { id: string; label: string }[] = [
  { id: "1", label: "1m" },
  { id: "5", label: "5m" },
  { id: "15", label: "15m" },
  { id: "60", label: "1H" },
  { id: "240", label: "4H" },
  { id: "D", label: "1D" },
  { id: "W", label: "1W" },
];

const LS_WATCH = "mp_watchlist_v1";
const LS_LAYOUT = "mp_layout_v1";
const LS_SYMBOL = "mp_symbol_v1";
const LS_INTERVAL = "mp_interval_v1";

// load tv.js once
let tvScriptPromise: Promise<void> | null = null;
function loadTradingView(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).TradingView) return Promise.resolve();
  if (tvScriptPromise) return tvScriptPromise;
  tvScriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/tv.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load TradingView"));
    document.head.appendChild(s);
  });
  return tvScriptPromise;
}

function TVChart({ containerId, symbol, interval, hideTools = false }: { containerId: string; symbol: string; interval: string; hideTools?: boolean }) {
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    loadTradingView().then(() => {
      if (cancelled) return;
      const TV = (window as any).TradingView;
      if (!TV) return;
      // clear container
      const el = document.getElementById(containerId);
      if (el) el.innerHTML = "";
      widgetRef.current = new TV.widget({
        container_id: containerId,
        autosize: true,
        symbol,
        interval,
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "es",
        toolbar_bg: C.surface,
        enable_publishing: false,
        hide_side_toolbar: hideTools,
        hide_top_toolbar: false,
        allow_symbol_change: true,
        withdateranges: true,
        details: false,
        studies: [],
      });
    });
    return () => {
      cancelled = true;
      try { widgetRef.current?.remove?.(); } catch {}
      widgetRef.current = null;
    };
    // re-create on symbol/interval change (simpler than chart().setSymbol on cross-origin iframe)
  }, [containerId, symbol, interval, hideTools]);

  return <div id={containerId} className="h-full w-full" />;
}

function MarketSessionBadges() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const hUTC = now.getUTCHours();
  const sessions = [
    { name: "ASIA", open: hUTC >= 0 && hUTC < 8 },
    { name: "EU", open: hUTC >= 7 && hUTC < 16 },
    { name: "US", open: hUTC >= 13 && hUTC < 21 },
  ];
  return (
    <div className="hidden md:flex items-center gap-2 font-mono text-[10px]">
      {sessions.map((s) => (
        <span key={s.name} className="px-2 py-0.5 rounded border" style={{ borderColor: C.border, color: s.open ? C.up : C.muted, background: s.open ? "rgba(38,166,154,.08)" : "transparent" }}>
          <span className="inline-block size-1.5 rounded-full mr-1.5" style={{ background: s.open ? C.up : C.muted }} /> {s.name} {s.open ? "OPEN" : "CLOSED"}
        </span>
      ))}
    </div>
  );
}

function MarketPulsePage() {
  const [watchlist, setWatchlist] = useState<WatchItem[]>(() => {
    if (typeof window === "undefined") return DEFAULT_WATCH;
    try {
      const raw = localStorage.getItem(LS_WATCH);
      return raw ? (JSON.parse(raw) as WatchItem[]) : DEFAULT_WATCH;
    } catch { return DEFAULT_WATCH; }
  });
  const [symbol, setSymbol] = useState<string>(() => {
    if (typeof window === "undefined") return "BINANCE:BTCUSDT";
    return localStorage.getItem(LS_SYMBOL) || "BINANCE:BTCUSDT";
  });
  const [interval, setIntervalState] = useState<string>(() => {
    if (typeof window === "undefined") return "60";
    return localStorage.getItem(LS_INTERVAL) || "60";
  });
  const [layout, setLayout] = useState<"single" | "grid">(() => {
    if (typeof window === "undefined") return "single";
    return (localStorage.getItem(LS_LAYOUT) as any) || "single";
  });
  const [search, setSearch] = useState("");
  const [showRight, setShowRight] = useState(true);

  useEffect(() => { localStorage.setItem(LS_WATCH, JSON.stringify(watchlist)); }, [watchlist]);
  useEffect(() => { localStorage.setItem(LS_SYMBOL, symbol); }, [symbol]);
  useEffect(() => { localStorage.setItem(LS_INTERVAL, interval); }, [interval]);
  useEffect(() => { localStorage.setItem(LS_LAYOUT, layout); }, [layout]);

  const addSymbol = (raw: string) => {
    const s = raw.trim().toUpperCase();
    if (!s) return;
    const full = s.includes(":") ? s : `BINANCE:${s}`;
    if (watchlist.some((w) => w.symbol === full)) return;
    const kind: WatchItem["kind"] = full.includes("USDT") || full.includes("BTC") ? "crypto" : full.startsWith("FX:") || full.startsWith("OANDA:") ? "forex" : "stock";
    const label = full.split(":")[1] || full;
    setWatchlist((wl) => [...wl, { symbol: full, label, kind }]);
    setSearch("");
  };

  const removeSymbol = (sym: string) => setWatchlist((wl) => wl.filter((w) => w.symbol !== sym));

  const gridSymbols = useMemo(() => {
    const first = [symbol, ...watchlist.map((w) => w.symbol).filter((s) => s !== symbol)].slice(0, 4);
    while (first.length < 4) first.push("BINANCE:BTCUSDT");
    return first;
  }, [symbol, watchlist]);

  // demo news (static — no external API key required)
  const news = useMemo(() => [
    { t: "Fed signals data-dependent path as inflation cools", src: "Reuters", time: "08:42" },
    { t: "Bitcoin holds above key support amid ETF inflows", src: "CoinDesk", time: "08:21" },
    { t: "Apple unveils new AI-powered services at WWDC", src: "Bloomberg", time: "07:58" },
    { t: "Oil prices steady as OPEC+ maintains output policy", src: "WSJ", time: "07:30" },
    { t: "Ethereum L2 activity hits record weekly volume", src: "The Block", time: "06:55" },
    { t: "Nasdaq futures point to mixed open in tech sector", src: "CNBC", time: "06:20" },
  ], []);

  return (
    <div
      className="-m-4 md:-m-8 min-h-[calc(100vh-1rem)] flex flex-col font-[Inter,sans-serif]"
      style={{ background: C.bg, color: C.text }}
    >
      {/* Top bar */}
      <header
        className="flex items-center gap-3 px-4 h-12 border-b shrink-0"
        style={{ borderColor: C.border, background: C.surface }}
      >
        <div className="flex items-center gap-2">
          <div className="size-6 rounded grid place-items-center font-mono font-bold text-[11px]" style={{ background: C.accent, color: "#001" }}>MP</div>
          <span className="font-display font-bold tracking-tight">MarketPulse</span>
          <span className="hidden md:inline text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: C.bg, color: C.muted, border: `1px solid ${C.border}` }}>TERMINAL</span>
        </div>

        <div className="flex-1 max-w-md mx-auto relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5" style={{ color: C.muted }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = search.trim().toUpperCase();
                if (!v) return;
                const full = v.includes(":") ? v : `BINANCE:${v}`;
                setSymbol(full);
                addSymbol(v);
              }
            }}
            placeholder="Buscar símbolo (BTCUSDT, NASDAQ:AAPL, FX:EURUSD)…"
            className="w-full pl-7 pr-3 py-1.5 text-xs font-mono rounded outline-none focus:ring-1"
            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}
          />
        </div>

        <MarketSessionBadges />

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setLayout(layout === "single" ? "grid" : "single")}
            className="size-8 grid place-items-center rounded hover:bg-white/5"
            style={{ border: `1px solid ${C.border}`, color: C.muted }}
            aria-label="Cambiar layout"
            title={layout === "single" ? "Cuadrícula 2×2" : "Un gráfico"}
          >
            {layout === "single" ? <LayoutGrid className="size-4" /> : <Square className="size-4" />}
          </button>
          <button
            onClick={() => setShowRight((s) => !s)}
            className="hidden md:grid size-8 place-items-center rounded hover:bg-white/5"
            style={{ border: `1px solid ${C.border}`, color: C.muted }}
            aria-label="Panel"
          >
            <Star className="size-4" />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Watchlist */}
        <aside
          className="hidden md:flex w-56 lg:w-64 shrink-0 flex-col border-r"
          style={{ borderColor: C.border, background: C.surface }}
        >
          <div className="px-3 py-2 flex items-center justify-between border-b" style={{ borderColor: C.border }}>
            <span className="text-[10px] uppercase tracking-widest font-mono" style={{ color: C.muted }}>Watchlist</span>
            <button
              className="size-6 grid place-items-center rounded hover:bg-white/5"
              style={{ color: C.muted }}
              onClick={() => {
                const v = prompt("Símbolo (ej. NASDAQ:AAPL, BTCUSDT, FX:EURUSD)");
                if (v) addSymbol(v);
              }}
              aria-label="Añadir"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <ul className="flex-1 overflow-auto">
            {watchlist.map((w, i) => {
              const active = w.symbol === symbol;
              // pseudo-random but stable per symbol for change badge
              const seed = w.symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + i;
              const change = ((seed % 800) / 100) - 4;
              const up = change >= 0;
              const price = 100 + (seed * 13) % 5000 + ((seed * 7) % 100) / 100;
              return (
                <li
                  key={w.symbol}
                  className="group px-3 py-2 cursor-pointer flex items-center justify-between border-l-2"
                  style={{
                    borderColor: active ? C.accent : "transparent",
                    background: active ? "rgba(33,150,243,.08)" : "transparent",
                  }}
                  onClick={() => setSymbol(w.symbol)}
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-semibold truncate">{w.label}</div>
                    <div className="font-mono text-[10px]" style={{ color: C.muted }}>{w.symbol.split(":")[0]}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-xs tabular-nums">{price.toFixed(2)}</div>
                    <div
                      className="font-mono text-[10px] px-1.5 rounded inline-flex items-center gap-0.5"
                      style={{ color: up ? C.up : C.down, background: up ? "rgba(38,166,154,.1)" : "rgba(239,83,80,.1)" }}
                    >
                      {up ? <TrendingUp className="size-2.5" /> : <TrendingDown className="size-2.5" />}
                      {up ? "+" : ""}{change.toFixed(2)}%
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSymbol(w.symbol); }}
                    className="ml-1 opacity-0 group-hover:opacity-100 transition"
                    style={{ color: C.muted }}
                    aria-label="Quitar"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Center */}
        <section className="flex-1 min-w-0 flex flex-col">
          {/* Intervals bar */}
          <div className="flex items-center gap-1 px-3 h-10 border-b shrink-0" style={{ borderColor: C.border, background: C.surface }}>
            <span className="font-mono text-[10px] mr-2" style={{ color: C.muted }}>INTERVALO</span>
            {INTERVALS.map((iv) => {
              const active = iv.id === interval;
              return (
                <button
                  key={iv.id}
                  onClick={() => setIntervalState(iv.id)}
                  className="font-mono text-[11px] px-2 py-1 rounded"
                  style={{
                    background: active ? C.accent : "transparent",
                    color: active ? "#001" : C.muted,
                    border: `1px solid ${active ? C.accent : C.border}`,
                  }}
                >
                  {iv.label}
                </button>
              );
            })}
            <div className="ml-auto font-mono text-[11px]" style={{ color: C.text }}>
              <span style={{ color: C.muted }}>SYM </span>{symbol}
            </div>
          </div>

          {/* Chart area: ~70% */}
          <div className="shrink-0" style={{ height: "70vh", background: C.bg }}>
            {layout === "single" ? (
              <TVChart containerId="tv_main" symbol={symbol} interval={interval} />
            ) : (
              <div className="grid grid-cols-2 grid-rows-2 h-full gap-px" style={{ background: C.border }}>
                {gridSymbols.map((s, i) => (
                  <div key={i} style={{ background: C.bg }}>
                    <TVChart containerId={`tv_g_${i}`} symbol={s} interval={interval} hideTools />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* News */}
          <div className="flex-1 min-h-0 border-t" style={{ borderColor: C.border, background: C.surface }}>
            <div className="px-3 h-9 flex items-center gap-2 border-b" style={{ borderColor: C.border }}>
              <Newspaper className="size-3.5" style={{ color: C.accent }} />
              <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>News Wire</span>
            </div>
            <ul className="overflow-auto max-h-56">
              {news.map((n, i) => (
                <li key={i} className="px-3 py-2 border-b flex items-center gap-3 hover:bg-white/[0.02]" style={{ borderColor: C.border }}>
                  <span className="font-mono text-[10px] w-12 shrink-0" style={{ color: C.muted }}>{n.time}</span>
                  <span className="text-xs flex-1 truncate">{n.t}</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ color: C.accent, border: `1px solid ${C.border}` }}>{n.src}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Right tools */}
        {showRight && (
          <aside className="hidden lg:flex w-56 shrink-0 flex-col border-l" style={{ borderColor: C.border, background: C.surface }}>
            <div className="px-3 py-2 border-b" style={{ borderColor: C.border }}>
              <span className="text-[10px] uppercase tracking-widest font-mono" style={{ color: C.muted }}>Análisis</span>
            </div>
            <div className="p-3 space-y-4 text-xs">
              <ToolGroup label="Indicadores" items={["RSI", "MACD", "Bollinger", "EMA 20", "EMA 50", "Volumen"]} />
              <ToolGroup label="Dibujo" items={["Tendencia", "Fibonacci", "Horizontal", "Rectángulo", "Texto"]} />
              <ToolGroup label="Comparar" items={["SPX", "DXY", "VIX", "GOLD"]} />
            </div>
            <div className="mt-auto p-3 border-t" style={{ borderColor: C.border }}>
              <p className="font-mono text-[10px]" style={{ color: C.muted }}>
                Datos por TradingView. Las herramientas avanzadas se gestionan dentro del gráfico embebido.
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function ToolGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="font-mono text-[10px] mb-1.5" style={{ color: C.muted }}>{label.toUpperCase()}</div>
      <div className="flex flex-wrap gap-1">
        {items.map((it) => (
          <span
            key={it}
            className="font-mono text-[10px] px-2 py-1 rounded cursor-default hover:bg-white/5"
            style={{ border: `1px solid ${C.border}`, color: C.text }}
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}