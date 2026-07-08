import { type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyLicense, redeemLicense } from "@/lib/license.functions";
import { useState } from "react";

export function LicenseRedeemGate({ children }: { children: ReactNode }) {
  const licenseQ = useQuery({
    queryKey: ["my-license"],
    queryFn: () => getMyLicense(),
    retry: false,
  });

  if (licenseQ.isLoading) return null;
  if (licenseQ.data) return <>{children}</>;

  return <RedeemScreen onRedeemed={() => licenseQ.refetch()} />;
}

function RedeemScreen({ onRedeemed }: { onRedeemed: () => void }) {
  const [key, setKey] = useState("");
  const qc = useQueryClient();
  const redeemFn = useServerFn(redeemLicense);
  const m = useMutation({
    mutationFn: (k: string) => redeemFn({ data: { key: k } }),
    onSuccess: () => {
      toast.success("Licencia activada. ¡Bienvenido!");
      qc.invalidateQueries({ queryKey: ["my-license"] });
      onRedeemed();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/60 backdrop-blur p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#22c55e]/15 mb-4">
            <KeyRound className="h-7 w-7 text-[#22c55e]" />
          </div>
          <h1 className="text-2xl font-bold">Activa tu licencia</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ingresa el código único que recibiste por correo tras tu compra. Quedará ligado a tu cuenta de forma permanente.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim()) m.mutate(key.trim());
          }}
          className="mt-6 space-y-3"
        >
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX"
            maxLength={14}
            autoFocus
            className="text-center tracking-widest font-mono uppercase h-11"
          />
          <Button type="submit" disabled={m.isPending} className="w-full h-11 bg-[#22c55e] hover:bg-[#16a34a] text-white">
            {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activar licencia"}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="w-full gap-2" onClick={logout}>
            <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
          </Button>
        </form>
      </div>
    </div>
  );
}