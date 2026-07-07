import { createFileRoute } from "@tanstack/react-router";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode() {
  const block = () =>
    Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
  return `${block()}-${block()}-${block()}`;
}

const APP_URL = "https://wcsportafolio.lovable.app";

function emailHtml(code: string, buyerName: string | null) {
  const greet = buyerName ? `Hola ${buyerName},` : "¡Hola!";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0b0f19;font-family:Inter,Arial,sans-serif;color:#e5e7eb">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px">
    <div style="text-align:center;margin-bottom:32px">
      <div style="font-size:14px;letter-spacing:0.2em;color:#22c55e;font-weight:600">WECREATESTUDIO</div>
      <h1 style="font-size:26px;margin:12px 0 0;color:#fff">Tu código de acceso está listo</h1>
    </div>
    <p style="font-size:15px;line-height:1.6">${greet} gracias por tu compra de <b>Portafolio</b>. Aquí tienes tu código de activación de un solo uso:</p>
    <div style="margin:28px 0;padding:24px;background:#111827;border:1px solid #1f2937;border-radius:14px;text-align:center">
      <div style="font-size:12px;color:#9ca3af;letter-spacing:0.15em;margin-bottom:8px">CÓDIGO DE ACCESO</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:28px;letter-spacing:0.15em;color:#22c55e;font-weight:700">${code}</div>
    </div>
    <div style="text-align:center;margin:32px 0">
      <a href="${APP_URL}" style="display:inline-block;padding:14px 28px;background:#22c55e;color:#0b0f19;text-decoration:none;border-radius:10px;font-weight:700">Abrir la aplicación</a>
    </div>
    <ol style="font-size:14px;line-height:1.7;color:#cbd5e1;padding-left:20px">
      <li>Abre la aplicación con el botón de arriba.</li>
      <li>Crea tu cuenta con tu correo y contraseña.</li>
      <li>Ingresa el código <b>${code}</b> cuando se te solicite.</li>
    </ol>
    <p style="font-size:12px;color:#6b7280;margin-top:40px;text-align:center">Este código se vincula a la primera cuenta que lo canjee y no se puede reutilizar.<br/>© WeCreateStudio</p>
  </div></body></html>`;
}

async function sendEmail(to: string, code: string, buyerName: string | null) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!LOVABLE_API_KEY || !RESEND_API_KEY) throw new Error("Email credentials missing");
  const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify({
      from: "WeCreateStudio <noreply@we-create-studio.com>",
      to: [to],
      subject: "Tu código de acceso a Portafolio",
      html: emailHtml(code, buyerName),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend failed [${res.status}]: ${body}`);
  }
}

export const Route = createFileRoute("/api/public/hooks/hotmart")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.HOTMART_HOTTOK;
        if (!expected) return new Response("Not configured", { status: 500 });

        // Hotmart sends HOTTOK either as header or inside JSON body.
        const headerTok = request.headers.get("x-hotmart-hottok") ?? request.headers.get("hottok");
        const raw = await request.text();
        let payload: any = {};
        try {
          payload = raw ? JSON.parse(raw) : {};
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const bodyTok = payload?.hottok ?? payload?.data?.hottok;
        const tok = headerTok ?? bodyTok;
        if (tok !== expected) return new Response("Unauthorized", { status: 401 });

        const event: string = payload?.event ?? payload?.data?.event ?? "";
        const status: string =
          payload?.data?.purchase?.status ?? payload?.status ?? "";
        const isApproved =
          event === "PURCHASE_APPROVED" ||
          event === "PURCHASE_COMPLETE" ||
          status === "APPROVED" ||
          status === "COMPLETED";
        if (!isApproved) return Response.json({ ok: true, ignored: event || status });

        const buyer = payload?.data?.buyer ?? payload?.buyer ?? {};
        const buyerEmail: string | undefined = buyer.email;
        const buyerName: string | null = buyer.name ?? null;
        const transaction: string =
          payload?.data?.purchase?.transaction ?? payload?.transaction ?? "";
        if (!buyerEmail) return new Response("Missing buyer email", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotency: if we've already issued a code for this transaction, reuse it.
        let code: string | null = null;
        if (transaction) {
          const { data: existing } = await supabaseAdmin
            .from("access_codes")
            .select("code")
            .eq("source", `hotmart:${transaction}`)
            .maybeSingle();
          if (existing?.code) code = existing.code;
        }

        if (!code) {
          for (let i = 0; i < 5; i++) {
            const candidate = randomCode();
            const { data: row, error } = await supabaseAdmin
              .from("access_codes")
              .insert({
                code: candidate,
                buyer_email: buyerEmail,
                source: transaction ? `hotmart:${transaction}` : "hotmart",
              })
              .select("code")
              .single();
            if (!error && row) {
              code = row.code;
              break;
            }
            if (error && error.code !== "23505") {
              return new Response(error.message, { status: 500 });
            }
          }
        }

        if (!code) return new Response("Could not generate code", { status: 500 });

        try {
          await sendEmail(buyerEmail, code, buyerName);
        } catch (e) {
          console.error("Hotmart email send failed", e);
          return Response.json({ ok: true, code, email_sent: false });
        }

        return Response.json({ ok: true, code, email_sent: true });
      },
    },
  },
});