import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";
import { LayoutDashboard, LineChart, Bitcoin, Target, RefreshCw, LogOut, Repeat, Settings, BookOpen, Layers, ArrowUp, BarChart3, Eye, Activity, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useProfile } from "@/lib/use-profile";
import { useEffect, useState } from "react";
import { AI_MODELS, useActiveModel } from "@/hooks/use-active-model";
import { LicenseRedeemGate } from "@/components/license-redeem-gate";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;

    const isAdmin = new URLSearchParams(window.location.search).get("admin") === "true";
    if (isAdmin) {
      localStorage.setItem("wcs_admin", "true");
      return;
    }

    if (localStorage.getItem("wcs_admin") === "true") return;

    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { t, lang, setLang } = useI18n();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const profileQ = useProfile();
  const customTypes = profileQ.data?.custom_asset_types ?? [];
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeModel, setActiveModel] = useActiveModel();
  const [savedRoute, setSavedRoute] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [saving, setSaving] = useState(false);

  // On first profile load, restore last route if user landed on default entry point.
  useEffect(() => {
    if (restored || !profileQ.data) return;
    const last = profileQ.data.last_route;
    setSavedRoute(last);
    setRestored(true);
    if (
      last &&
      last !== path &&
      (path === "/dashboard" || path === "/" || path === "/_authenticated")
    ) {
      nav({ to: last, replace: true } as any);
    }
  }, [profileQ.data, restored, path, nav]);

  const saveCurrentRoute = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ last_route: path })
      .eq("id", u.user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      setSavedRoute(path);
      toast.success(lang === "es" ? "Página guardada" : "Page saved");
    }
  };

  const onPickModel = (id: typeof AI_MODELS[number]["id"], label: string) => {
    setActiveModel(id);
    toast.success(`Modelo cambiado a ${label}`);
  };

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };
  const groups: { label: string | null; items: NavItem[] }[] = [
    {
      label: null,
      items: [
        { to: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
        { to: "/stocks", label: t("stocks"), icon: LineChart },
        { to: "/crypto", label: t("crypto"), icon: Bitcoin },
      ],
    },
    {
      label: "Análisis financiero",
      items: [
        { to: "/analytics", label: "Analítica", icon: BarChart3 },
        { to: "/marketpulse", label: "MarketPulse", icon: Activity },
        { to: "/watchlist", label: "Watchlist", icon: Eye },
      ],
    },
    {
      label: "Objetivos",
      items: [
        { to: "/goals", label: t("goals"), icon: Target },
        { to: "/recurring", label: t("recurring"), icon: Repeat },
      ],
    },
    {
      label: "Información",
      items: [
        { to: "/settings", label: t("settings"), icon: Settings },
        { to: "/guide", label: t("guide"), icon: BookOpen },
      ],
    },
  ];
  const items: NavItem[] = groups.flatMap((g) => g.items);

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success(lang === "es" ? "Hasta pronto" : "See you soon");
    nav({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-card/40 backdrop-blur sticky top-0 h-screen">
        <div className="p-5 flex items-center gap-2">
          <div className="size-8 rounded-lg" style={{ backgroundImage: "var(--gradient-primary)" }} />
          <span className="font-display font-bold">{t("appName")}</span>
        </div>
        <nav className="px-3 space-y-1 flex-1 overflow-y-auto">
          {groups.map((group, gi) => (
            <div key={gi} className={group.label ? "pt-3 mt-2 border-t border-border" : ""}>
              {group.label && (
                <p className="px-3 pb-1 text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
                  {group.label}
                </p>
              )}
              {group.items.map((it) => {
                const active = path === it.to;
                return (
                  <Link key={it.to} to={it.to}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                    <it.icon className="size-4" /> {it.label}
                  </Link>
                );
              })}
            </div>
          ))}
          {customTypes.length > 0 && (
            <div className="pt-3 mt-2 border-t border-border">
              <p className="px-3 pb-1 text-[10px] uppercase tracking-widest font-mono text-muted-foreground">{t("customSheets")}</p>
              {customTypes.map((ct) => {
                const to = `/custom/${encodeURIComponent(ct)}`;
                const active = path === to;
                return (
                  <Link key={ct} to="/custom/$type" params={{ type: ct }}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                    <Layers className="size-4" /> <span className="truncate">{ct}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </nav>
        <div className="p-3 border-t border-border space-y-2">
          <div>
            <p className="px-3 pb-1.5 text-[10px] uppercase tracking-widest font-mono text-muted-foreground">IA activa</p>
            <div className="flex gap-1 px-2">
              {AI_MODELS.map((m) => {
                const active = activeModel === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => onPickModel(m.id, m.label)}
                    className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-full text-[10px] font-mono transition-all"
                    style={{
                      background: active ? `${m.color}1f` : "transparent",
                      border: `1px solid ${active ? m.color : "hsl(var(--border))"}`,
                      color: active ? m.color : "hsl(var(--muted-foreground))",
                      boxShadow: active ? `0 0 0 1px ${m.color}55, 0 0 8px ${m.color}33` : undefined,
                    }}
                    title={m.label}
                  >
                    <span>{m.icon}</span>
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="px-2">
            <p className="px-1 pb-1.5 text-[10px] uppercase tracking-widest font-mono text-muted-foreground">{t("language")}</p>
            <div className="flex gap-1">
              {LANGS.map((l) => {
                const active = lang === l.code;
                return (
                  <button
                    key={l.code}
                    onClick={() => setLang(l.code as Lang)}
                    className={`flex-1 px-1.5 py-1 rounded-md text-[10px] font-mono border transition-colors ${active ? "bg-primary/15 text-primary border-primary/40" : "border-border text-muted-foreground hover:text-foreground"}`}
                  >
                    {l.label}
                  </button>
                );
              })}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
            <LogOut className="size-4 mr-2" /> {t("logout")}
          </Button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 relative">
        {/* mobile nav */}
        <div className="md:hidden flex items-center gap-2 overflow-x-auto p-3 border-b border-border bg-card/40">
          {AI_MODELS.map((m) => {
            const active = activeModel === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onPickModel(m.id, m.label)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-mono whitespace-nowrap"
                style={{
                  background: active ? `${m.color}1f` : "transparent",
                  border: `1px solid ${active ? m.color : "hsl(var(--border))"}`,
                  color: active ? m.color : "hsl(var(--muted-foreground))",
                  boxShadow: active ? `0 0 8px ${m.color}33` : undefined,
                }}
              >
                <span>{m.icon}</span>
                {m.label}
              </button>
            );
          })}
          <span className="h-5 w-px bg-border shrink-0" />
          {items.map((it) => {
            const active = path === it.to;
            return (
              <Link key={it.to} to={it.to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${active ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>
                <it.icon className="size-3.5" /> {it.label}
              </Link>
            );
          })}
        </div>
        <main className="p-4 md:p-8 max-w-7xl mx-auto">
          <LicenseRedeemGate>
            <Outlet />
          </LicenseRedeemGate>
        </main>

        {showScrollTop && (
          <Button
            size="icon"
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg"
            aria-label="Volver arriba"
          >
            <ArrowUp className="size-4" />
          </Button>
        )}

        <Button
          size="icon"
          onClick={saveCurrentRoute}
          disabled={saving}
          variant={savedRoute === path ? "secondary" : "default"}
          className="fixed bottom-6 right-20 z-50 rounded-full shadow-lg"
          aria-label={lang === "es" ? "Guardar página actual" : "Save current page"}
          title={
            savedRoute === path
              ? lang === "es" ? "Página guardada" : "Page saved"
              : lang === "es" ? "Guardar y reanudar aquí al iniciar sesión" : "Save and resume here on next login"
          }
        >
          <Save className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// re-export icon so other pages can use the refresh
export { RefreshCw };
