import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, X, Layers, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type Lang } from "@/lib/i18n";
import { useProfile, CURRENCIES, type Currency } from "@/lib/use-profile";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { user } = useAuth();
  const profileQ = useProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState<Currency>("USD");
  const [types, setTypes] = useState<string[]>([]);
  const [newType, setNewType] = useState("");
  const [subtypes, setSubtypes] = useState<Record<string, string[]>>({});
  const [newSubtype, setNewSubtype] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!profileQ.data) return;
    setName(profileQ.data.display_name ?? "");
    setBaseCurrency((profileQ.data.base_currency as Currency) ?? "USD");
    setTypes(profileQ.data.custom_asset_types ?? []);
    setSubtypes(profileQ.data.custom_panel_subtypes ?? {});
  }, [profileQ.data]);

  const persistTypes = async (next: string[], nextSubtypes?: Record<string, string[]>) => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      custom_asset_types: next,
      ...(nextSubtypes ? { custom_panel_subtypes: nextSubtypes as any } : {}),
    }).eq("id", user.id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    await qc.invalidateQueries({ queryKey: ["profile"] });
    return true;
  };

  const addType = async () => {
    const v = newType.trim();
    if (!v || types.includes(v)) return;
    const next = [...types, v];
    const nextSubs = { ...subtypes, [v]: subtypes[v] ?? [] };
    setTypes(next);
    setSubtypes(nextSubs);
    setNewType("");
    const ok = await persistTypes(next, nextSubs);
    if (ok) {
      toast.success(t("saved"));
      navigate({ to: "/custom/$type", params: { type: v } });
    }
  };
  const removeType = async (v: string) => {
    const next = types.filter((x) => x !== v);
    const nextSubs = { ...subtypes };
    delete nextSubs[v];
    setTypes(next);
    setSubtypes(nextSubs);
    await persistTypes(next, nextSubs);
  };

  const addSubtype = async (panel: string) => {
    const v = (newSubtype[panel] ?? "").trim();
    if (!v) return;
    const existing = subtypes[panel] ?? [];
    if (existing.includes(v)) return;
    const nextSubs = { ...subtypes, [panel]: [...existing, v] };
    setSubtypes(nextSubs);
    setNewSubtype({ ...newSubtype, [panel]: "" });
    await persistTypes(types, nextSubs);
  };

  const removeSubtype = async (panel: string, v: string) => {
    const nextSubs = { ...subtypes, [panel]: (subtypes[panel] ?? []).filter((x) => x !== v) };
    setSubtypes(nextSubs);
    await persistTypes(types, nextSubs);
  };

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      display_name: name,
      language: lang,
      base_currency: baseCurrency,
      custom_asset_types: types,
      custom_panel_subtypes: subtypes as any,
    }).eq("id", user.id);
    if (error) toast.error(error.message);
    else {
      toast.success(t("saved"));
      qc.invalidateQueries({ queryKey: ["profile"] });
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl md:text-4xl font-display font-bold">{t("settings")}</h1>
      <div className="card-surface p-6 space-y-4">
        <div><Label>{t("name")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div>
          <Label>{t("language")}</Label>
          <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="es">Español</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t("baseCurrency")}</Label>
          <Select value={baseCurrency} onValueChange={(v) => setBaseCurrency(v as Currency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="border-t border-border pt-4">
          <Label className="text-base font-display">{t("customAssetTypes")}</Label>
          <p className="text-sm text-muted-foreground mt-1 mb-3">{t("customAssetTypesHelp")}</p>
          <div className="flex gap-2">
            <Input
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addType(); } }}
              placeholder={t("newTypePlaceholder")}
            />
            <Button type="button" variant="secondary" onClick={addType}><Plus className="size-4 mr-1" />{t("addType")}</Button>
          </div>
          {types.length > 0 && (
            <div className="grid gap-2 mt-4">
              {types.map((tp) => (
                <div key={tp} className="rounded-md border border-border bg-muted/40 px-3 py-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Layers className="size-4 text-primary shrink-0" />
                      <span className="text-sm font-semibold truncate">{tp}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link to="/custom/$type" params={{ type: tp }}>
                        <Button type="button" variant="ghost" size="sm">
                          <ExternalLink className="size-3.5 mr-1" />{t("openPanel")}
                        </Button>
                      </Link>
                      <button type="button" onClick={() => removeType(tp)} className="p-1 text-muted-foreground hover:text-destructive" aria-label={t("delete")}>
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div className="pl-6 space-y-2">
                    <p className="text-xs text-muted-foreground">{t("subtypesHelp")}</p>
                    <div className="flex flex-wrap gap-1">
                      {(subtypes[tp] ?? []).map((s) => (
                        <span key={s} className="inline-flex items-center gap-1 rounded-full bg-background border border-border px-2 py-0.5 text-xs">
                          {s}
                          <button type="button" onClick={() => removeSubtype(tp, s)} className="text-muted-foreground hover:text-destructive" aria-label={t("delete")}>
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                      {(subtypes[tp] ?? []).length === 0 && (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={newSubtype[tp] ?? ""}
                        onChange={(e) => setNewSubtype({ ...newSubtype, [tp]: e.target.value })}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubtype(tp); } }}
                        placeholder={t("newSubtypePlaceholder")}
                        className="h-8 text-sm"
                      />
                      <Button type="button" variant="secondary" size="sm" onClick={() => addSubtype(tp)}>
                        <Plus className="size-3.5 mr-1" />{t("addSubtype")}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button onClick={save}>{t("save")}</Button>
      </div>
      <div className="card-surface p-6 text-sm text-muted-foreground">
        <p>{user?.email}</p>
      </div>
    </div>
  );
}
