import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Briefcase } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { redeemLicense } from "@/lib/license.functions";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
});

const CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    if (!email || !password) return toast.error("Completa email y contraseña");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    nav({ to: "/dashboard" });
  };

  const signUp = async () => {
    if (!email || !password) return toast.error("Completa email y contraseña");
    const normalized = code.trim().toUpperCase();
    if (!CODE_RE.test(normalized)) {
      return toast.error("Código inválido. Formato XXXX-XXXX-XXXX.");
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    if (!data.session) {
      setLoading(false);
      toast.success("Cuenta creada. Revisa tu correo para confirmar.");
      return;
    }
    try {
      await redeemLicense({ data: { key: normalized } });
      toast.success("Cuenta creada");
      nav({ to: "/dashboard" });
    } catch (e) {
      await supabase.auth.signOut();
      toast.error((e as Error).message || "Código no válido");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
    if (r.error) toast.error(r.error.message);
  };

  const apple = async () => {
    const r = await lovable.auth.signInWithOAuth("apple" as any, { redirect_uri: window.location.origin + "/dashboard" });
    if (r.error) toast.error(r.error.message);
  };

  const isSignup = mode === "signup";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "var(--gradient-hero)" }} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-surface p-8 w-full max-w-md relative z-10"
      >
        <div className="flex flex-col items-center text-center mb-6">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl mb-4 shadow-lg"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          >
            <Briefcase className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold font-display">Portafolio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignup ? "Crea tu cuenta" : "Inicia sesión para continuar"}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            isSignup ? signUp() : signIn();
          }}
          className="space-y-3"
        >
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <Label>Contraseña</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignup ? "new-password" : "current-password"}
            />
          </div>

          {isSignup && (
            <div>
              <Label>Código de validación</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX"
                maxLength={14}
                className="text-center tracking-widest font-mono uppercase"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Recibiste este código al comprar la app.
              </p>
            </div>
          )}

          {!isSignup && (
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-[#22c55e] hover:bg-[#16a34a] text-white"
          >
            {isSignup ? "Registrarse" : "Iniciar sesión"}
          </Button>
        </form>

        <div className="flex items-center gap-3 my-5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <div className="h-px bg-border flex-1" />
          <span>O continúa con</span>
          <div className="h-px bg-border flex-1" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={google} type="button" className="gap-2">
            <GoogleIcon /> Google
          </Button>
          <Button variant="outline" onClick={apple} type="button" className="gap-2">
            <AppleIcon /> Apple
          </Button>
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {isSignup ? (
            <>
              ¿Ya tienes cuenta?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-primary hover:underline font-medium"
              >
                Inicia sesión
              </button>
            </>
          ) : (
            <>
              ¿No tienes cuenta?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="text-primary hover:underline font-medium"
              >
                Regístrate
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.1c-2 1.4-4.5 2.3-7.2 2.3-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.1C41 34.5 44 29.7 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.42 2.22-1.24 3.03-.87.87-2.02 1.53-3.16 1.44-.13-1.1.42-2.24 1.2-2.99.86-.83 2.14-1.44 3.2-1.48zM20.5 17.14c-.55 1.28-.82 1.85-1.54 2.98-.98 1.55-2.36 3.48-4.07 3.5-1.52.01-1.91-.99-3.98-.98-2.07.01-2.5.99-4.02.98-1.71-.02-3.02-1.77-4-3.32C.98 15.85-.03 12.14 1.35 9.5c.98-1.87 2.53-3.05 3.99-3.05 1.48 0 2.42.82 3.65.82 1.19 0 1.92-.82 3.63-.82 1.29 0 2.66.7 3.64 1.91-3.2 1.75-2.68 6.31.24 8.78z"/>
    </svg>
  );
}
