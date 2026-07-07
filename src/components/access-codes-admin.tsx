import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Plus, Copy, Trash2, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  amIAdmin,
  listAccessCodes,
  generateAccessCode,
  deleteAccessCode,
} from "@/lib/license.functions";

export function AccessCodesAdminButton() {
  const [open, setOpen] = useState(false);
  const amIAdminFn = useServerFn(amIAdmin);
  const adminQ = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => amIAdminFn(),
    staleTime: 5 * 60_000,
    retry: false,
  });
  if (!adminQ.data?.admin) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          title="Códigos de acceso"
          className="fixed bottom-4 right-4 z-40 h-11 w-11 rounded-full shadow-lg"
        >
          <KeyRound className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> Códigos de acceso
          </DialogTitle>
        </DialogHeader>
        {open ? <Panel /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Panel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAccessCodes);
  const genFn = useServerFn(generateAccessCode);
  const delFn = useServerFn(deleteAccessCode);
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["access-codes"], queryFn: () => listFn() });

  const gen = useMutation({
    mutationFn: () => genFn({ data: { buyer_email: email || null } }),
    onSuccess: (row) => {
      toast.success(`Código generado: ${row.code}`);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["access-codes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Código eliminado");
      qc.invalidateQueries({ queryKey: ["access-codes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1200);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo del comprador (opcional)"
          type="email"
        />
        <Button onClick={() => gen.mutate()} disabled={gen.isPending} className="gap-2">
          {gen.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Generar
        </Button>
      </div>

      <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Código</th>
              <th className="px-3 py-2 text-left">Comprador</th>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {q.data?.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono">{c.code}</td>
                <td className="px-3 py-2 text-muted-foreground">{c.buyer_email ?? "—"}</td>
                <td className="px-3 py-2">
                  {c.used_by ? (
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">Usado</span>
                  ) : (
                    <span className="rounded bg-emerald-500/15 text-emerald-500 px-2 py-0.5 text-xs">
                      Disponible
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => copy(c.code)} title="Copiar">
                      {copied === c.code ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-500"
                      onClick={() => del.mutate(c.id)}
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {q.data && q.data.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  No hay códigos aún. Genera el primero arriba.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}