import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function normalize(code: string) {
  return code.trim().toUpperCase();
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = () =>
    Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `${block()}-${block()}-${block()}`;
}

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No autorizado");
}

// Returns the redeemed code for the current user (or null).
export const getMyLicense = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("access_codes")
      .select("code, used_at")
      .eq("used_by", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? { license_key: data.code, created_at: data.used_at } : null;
  });

export const redeemLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ key: z.string().trim().min(12).max(32) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const code = normalize(data.key);
    if (!CODE_RE.test(code)) {
      throw new Error("Formato inválido. Usa XXXX-XXXX-XXXX.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Already redeemed by this user?
    const { data: mine } = await supabaseAdmin
      .from("access_codes")
      .select("code")
      .eq("used_by", context.userId)
      .maybeSingle();
    if (mine) return { ok: true };

    const { data: row, error: rowErr } = await supabaseAdmin
      .from("access_codes")
      .select("id, used_by")
      .eq("code", code)
      .maybeSingle();
    if (rowErr) throw new Error(rowErr.message);
    if (!row) throw new Error("Código no válido.");
    if (row.used_by) {
      if (row.used_by === context.userId) return { ok: true };
      throw new Error("Este código ya fue canjeado por otra cuenta.");
    }

    // Atomic claim: only succeeds if still unclaimed.
    const { data: updated, error: updErr } = await supabaseAdmin
      .from("access_codes")
      .update({ used_by: context.userId, used_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("used_by", null)
      .select("id")
      .maybeSingle();
    if (updErr) throw new Error(updErr.message);
    if (!updated) throw new Error("El código fue canjeado por otra cuenta.");
    return { ok: true };
  });

// ---- Admin ----

export const listAccessCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("access_codes")
      .select("id, code, used_by, used_at, buyer_email, source, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const generateAccessCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ buyer_email: z.string().email().optional().nullable() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (let i = 0; i < 5; i++) {
      const code = randomCode();
      const { data: row, error } = await supabaseAdmin
        .from("access_codes")
        .insert({ code, buyer_email: data.buyer_email ?? null, source: "admin" })
        .select("id, code, created_at")
        .single();
      if (!error) return row;
      if (error.code !== "23505") throw new Error(error.message);
    }
    throw new Error("No se pudo generar un código único. Reintenta.");
  });

export const deleteAccessCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("access_codes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { admin: Boolean(data) };
  });