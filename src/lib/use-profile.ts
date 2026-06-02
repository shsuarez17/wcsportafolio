import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProfileData = {
  display_name: string | null;
  language: string;
  base_currency: string;
  custom_asset_types: string[];
  custom_currencies: string[];
};

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<ProfileData> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("not authenticated");
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, language, base_currency, custom_asset_types, custom_currencies")
        .eq("id", u.user.id)
        .maybeSingle();
      if (error) throw error;
      return {
        display_name: data?.display_name ?? null,
        language: data?.language ?? "es",
        base_currency: data?.base_currency ?? "USD",
        custom_asset_types: (data?.custom_asset_types as string[] | null) ?? [],
        custom_currencies: ((data as any)?.custom_currencies as string[] | null) ?? [],
      };
    },
  });
}

export const DEFAULT_CURRENCIES = ["USD", "COP", "EUR", "MXN", "BRL"] as const;
export const CURRENCIES: readonly string[] = DEFAULT_CURRENCIES;
export type Currency = string;

export function useAllCurrencies(): string[] {
  const p = useProfile();
  const custom = p.data?.custom_currencies ?? [];
  return Array.from(new Set([...DEFAULT_CURRENCIES, ...custom]));
}

export function useUsdRates() {
  return useQuery({
    queryKey: ["usd-rates"],
    queryFn: async () => {
      const r = await fetch("https://open.er-api.com/v6/latest/USD");
      const j = r.ok ? await r.json() : {};
      const rates = (j?.rates ?? {}) as Record<string, number>;
      // Return ALL currencies the API gives us (170+), plus sensible fallbacks
      const all: Record<string, number> = {
        USD: 1,
        COP: 4000,
        EUR: 0.92,
        MXN: 18,
        BRL: 5,
        ...rates,
        USD_FIXED: 1,
      };
      all.USD = 1;
      return all as Record<string, number>;
    },
    staleTime: 10 * 60_000,
  });
}
