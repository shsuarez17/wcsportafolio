import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL_MAP = {
  gpt5: "openai/gpt-5",
  gpt5mini: "openai/gpt-5-mini",
  gemini: "google/gemini-3-flash-preview",
} as const;
type ModelId = keyof typeof MODEL_MAP;

const AnalyzeInput = z.object({
  symbol: z.string().min(1).max(64),
  interval: z.string().min(1).max(8),
  price: z.number().nullable().optional(),
  change: z.number().nullable().optional(),
  analysisType: z.enum(["technical", "fundamental", "sentiment"]).default("technical"),
  model: z.enum(["gpt5", "gpt5mini", "gemini"]),
  save: z.boolean().default(true),
});

export const analyzeMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AnalyzeInput.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const systemPrompt =
      "Eres un analista técnico experto en mercados financieros. Responde siempre en español, conciso y estructurado. Usa exactamente estos bloques con emojis: 📈 Tendencia, 🎯 Niveles clave, ⚡ Señal, ⚠️ Riesgo.";
    const userPrompt =
      `Analiza ${data.symbol} en intervalo ${data.interval}.` +
      (data.price != null ? ` Precio actual: ${data.price}.` : "") +
      (data.change != null ? ` Cambio: ${data.change}%.` : "") +
      ` Tipo de análisis: ${data.analysisType}.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: MODEL_MAP[data.model as ModelId],
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Límite de IA alcanzado. Intenta en un momento.");
      if (res.status === 402) throw new Error("Sin créditos de IA. Recarga en la configuración de Lovable Cloud.");
      throw new Error(`AI Gateway ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const result = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!result) throw new Error("La IA devolvió una respuesta vacía.");

    if (data.save) {
      const { error } = await context.supabase.from("saved_analyses").insert({
        user_id: context.userId,
        symbol: data.symbol,
        interval: data.interval,
        price: data.price ?? null,
        change_pct: data.change ?? null,
        analysis_type: data.analysisType,
        prompt: userPrompt,
        result,
        ai_model: data.model,
      });
      if (error) console.error("saved_analyses insert failed", error);
    }

    return { result, model: data.model };
  });

export const listAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("saved_analyses")
      .select("id, symbol, interval, ai_model, result, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const deleteAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("saved_analyses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });