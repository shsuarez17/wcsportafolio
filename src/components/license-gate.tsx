import { useEffect, useState, type ReactNode } from "react";
import { Loader2, KeyRound, HelpCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STORAGE_KEY = "wcs_license_key";
const PRODUCT_ID = "qmlgyu";

export function LicenseGate({ children }: { children: ReactNode }) {
  const [licensed, setLicensed] = useState<boolean | null>(null);
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(STORAGE_KEY);
    setLicensed(!!saved);
  }, []);

  async function activate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!key.trim()) return;
    setLoading(true);
    try {
      const body = new URLSearchParams({ product_id: PRODUCT_ID, license_key: key.trim() });
      const res = await fetch("https://api.gumroad.com/v2/licenses/verify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const data = await res.json().catch(() => ({ success: false }));
      if (res.ok && data.success) {
        localStorage.setItem(STORAGE_KEY, key.trim());
        setLicensed(true);
      } else {
        setError("Licencia inválida. Revisa tu correo e inténtalo de nuevo.");
      }
    } catch {
      setError("No se pudo verificar la licencia. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (licensed === null) return null;

  if (!licensed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background px-4 animate-in fade-in duration-500">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card/60 backdrop-blur p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#22c55e]/15 mb-4">
              <KeyRound className="h-7 w-7 text-[#22c55e]" />
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">WeCreateStudio</p>
            <h1 className="mt-2 text-2xl font-bold">Activa tu licencia</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ingresa la clave que recibiste para desbloquear la aplicación.
            </p>
          </div>
          <form onSubmit={activate} className="mt-6 space-y-3">
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              autoFocus
              className="text-center tracking-widest font-mono uppercase h-11"
            />
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#22c55e] hover:bg-[#16a34a] text-white"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activar"}
            </Button>
            <p className="text-xs text-center text-muted-foreground pt-2">
              Recibiste tu clave de licencia por correo después de la compra.
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      <LicenseBadge onSignOut={() => { localStorage.removeItem(STORAGE_KEY); setLicensed(false); setKey(""); }} />
    </>
  );
}

function LicenseBadge({ onSignOut }: { onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const savedKey = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) ?? "" : "";
  const masked = savedKey.length > 8 ? `${savedKey.slice(0, 4)}••••${savedKey.slice(-4)}` : savedKey;
  return (
    <div className="fixed bottom-4 right-4 z-40">
      {open && (
        <div className="mb-2 w-64 rounded-lg border border-border bg-card p-3 shadow-xl text-sm">
          <p className="text-xs text-muted-foreground">Tu licencia</p>
          <p className="font-mono text-xs break-all mt-1">{masked}</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 gap-2"
            onClick={onSignOut}
          >
            <LogOut className="h-3.5 w-3.5" /> Cerrar licencia
          </Button>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-9 w-9 rounded-full border border-border bg-card/80 backdrop-blur flex items-center justify-center text-muted-foreground hover:text-foreground shadow-lg"
        aria-label="License info"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
    </div>
  );
}