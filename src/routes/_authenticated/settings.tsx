import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, X, Layers, ExternalLink, Coins, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type Lang } from "@/lib/i18n";
import { useProfile, DEFAULT_CURRENCIES, useUsdRates, type Currency } from "@/lib/use-profile";
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
  const ratesQ = useUsdRates();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState<Currency>("USD");
  const [types, setTypes] = useState<string[]>([]);
  const [newType, setNewType] = useState("");
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [newCcy, setNewCcy] = useState("");

  useEffect(() => {
    if (!profileQ.data) return;
    setName(profileQ.data.display_name ?? "");
    setBaseCurrency((profileQ.data.base_currency as Currency) ?? "USD");
    setTypes(profileQ.data.custom_asset_types ?? []);
    setCurrencies(profileQ.data.custom_currencies ?? []);
  }, [profileQ.data]);

  const addType = () => {
    const v = newType.trim();
    if (!v || types.includes(v)) return;
    setTypes([...types, v]);
    setNewType("");
  };
  const removeType = (v: string) => setTypes(types.filter((x) => x !== v));

  const knownRates = ratesQ.data ?? {};
  const addCurrency = () => {
    const v = newCcy.trim().toUpperCase();
    if (!v || v.length < 3 || v.length > 5) {
      toast.error(lang === "es" ? "Código inválido (3-5 letras)" : "Invalid code (3-5 letters)");
      return;
    }
    if ((DEFAULT_CURRENCIES as readonly string[]).includes(v) || currencies.includes(v)) return;
    if (!(v in knownRates)) {
      toast.error(lang === "es" ? `Moneda "${v}" no encontrada en tasas en vivo` : `Currency "${v}" not found in live rates`);
      return;
    }
    setCurrencies([...currencies, v]);
    setNewCcy("");
  };
  const removeCurrency = (v: string) => setCurrencies(currencies.filter((x) => x !== v));

  // Suggest known currencies for the datalist
  const currencySuggestions = Object.keys(knownRates).filter(
    (k) => !(DEFAULT_CURRENCIES as readonly string[]).includes(k) && k !== "USD_FIXED",
  ).sort();

  const allBaseOptions = Array.from(new Set([...DEFAULT_CURRENCIES, ...currencies]));

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      display_name: name,
      language: lang,
      base_currency: baseCurrency,
      custom_asset_types: types,
      custom_currencies: currencies,
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
              <SelectItem value="fr">Français</SelectItem>
              <SelectItem value="it">Italiano</SelectItem>
              <SelectItem value="de">Deutsch</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t("baseCurrency")}</Label>
          <Select value={baseCurrency} onValueChange={(v) => setBaseCurrency(v as Currency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {allBaseOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Custom currencies */}
        <div className="border-t border-border pt-4">
          <Label className="text-base font-display">
            {lang === "es" ? "Monedas personalizadas" : lang === "en" ? "Custom currencies" : lang === "fr" ? "Devises personnalisées" : lang === "it" ? "Valute personalizzate" : "Benutzerdefinierte Währungen"}
          </Label>
          <p className="text-sm text-muted-foreground mt-1 mb-3">
            {lang === "es"
              ? "Busca y añade códigos ISO (ej: GBP, JPY, CAD, CHF, ARS, PEN). Se sumarán a las monedas disponibles."
              : lang === "en"
              ? "Search and add ISO codes (e.g. GBP, JPY, CAD, CHF, ARS, PEN). They'll be added to available currencies."
              : lang === "fr"
              ? "Recherchez et ajoutez des codes ISO (ex. GBP, JPY, CAD)."
              : lang === "it"
              ? "Cerca e aggiungi codici ISO (es. GBP, JPY, CAD)."
              : "Suche und füge ISO-Codes hinzu (z.B. GBP, JPY, CAD)."}
          </p>
          <div className="flex gap-2">
            <Input
              list="currency-suggestions"
              value={newCcy}
              onChange={(e) => setNewCcy(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCurrency(); } }}
              placeholder="GBP, JPY, CAD..."
              maxLength={5}
              className="uppercase"
            />
            <datalist id="currency-suggestions">
              {currencySuggestions.map((c) => <option key={c} value={c} />)}
            </datalist>
            <Button type="button" variant="secondary" onClick={addCurrency}>
              <Plus className="size-4 mr-1" />
              {lang === "es" ? "Añadir" : lang === "en" ? "Add" : lang === "fr" ? "Ajouter" : lang === "it" ? "Aggiungi" : "Hinzufügen"}
            </Button>
          </div>
          {currencies.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {currencies.map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-sm">
                  <Coins className="size-3.5 text-primary" />
                  <span className="font-mono">{c}</span>
                  <button type="button" onClick={() => removeCurrency(c)} className="text-muted-foreground hover:text-destructive" aria-label="remove">
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
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
                <div key={tp} className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Layers className="size-4 text-primary shrink-0" />
                    <span className="text-sm truncate">{tp}</span>
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
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1.5">
            <Tag className="size-3.5 mt-0.5 shrink-0" />
            <span>
              {lang === "es"
                ? "Cada panel aparece automáticamente en el menú lateral como acceso rápido y en la guía."
                : lang === "en"
                ? "Each panel automatically appears in the sidebar as a quick link and in the guide."
                : lang === "fr"
                ? "Chaque panneau apparaît automatiquement dans la barre latérale et dans le guide."
                : lang === "it"
                ? "Ogni pannello appare automaticamente nella barra laterale e nella guida."
                : "Jedes Panel erscheint automatisch in der Seitenleiste und in der Anleitung."}
            </span>
          </p>
        </div>

        <Button onClick={save}>{t("save")}</Button>
      </div>
      <div className="card-surface p-6 text-sm text-muted-foreground">
        <p>{user?.email}</p>
      </div>
    </div>
  );
}
