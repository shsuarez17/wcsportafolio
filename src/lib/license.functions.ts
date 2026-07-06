import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PRODUCT_ID = "qmlgyu";

export const getMyLicense = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("license_redemptions")
      .select("license_key, created_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const redeemLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: z.string().trim().min(4) }).parse(d))
  .handler(async ({ data, context }) => {
    const key = data.key.trim();

    // If user already redeemed this exact key, return success (idempotent).
    const { data: existing } = await context.supabase
      .from("license_redemptions")
      .select("license_key, user_id")
      .eq("license_key", key)
      .maybeSingle();
    if (existing) {
      if (existing.user_id === context.userId) return { ok: true };
      throw new Error("Esta licencia ya fue canjeada por otro usuario.");
    }

    // Verify with Gumroad
    const body = new URLSearchParams({ product_id: PRODUCT_ID, license_key: key });
    const res = await fetch("https://api.gumroad.com/v2/licenses/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json: any = await res.json().catch(() => ({ success: false }));
    if (!res.ok || !json.success) {
      throw new Error("Licencia inválida. Revisa el código recibido por correo.");
    }

    // Insert via service role to bypass RLS write (no INSERT policy for users).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: insErr } = await supabaseAdmin.from("license_redemptions").insert({
      license_key: key,
      user_id: context.userId,
      product_id: PRODUCT_ID,
    });
    if (insErr) {
      if (insErr.code === "23505") {
        throw new Error("Esta licencia ya fue canjeada o tu cuenta ya tiene una licencia activa.");
      }
      throw new Error(insErr.message);
    }
    return { ok: true };
  });