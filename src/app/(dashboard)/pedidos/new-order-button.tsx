"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy, CheckCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { getOrgsAndMenusForModal, createManualOrder } from "@/app/actions/orders";

type Org = { id: string; name: string };
type Menu = { id: string; week_label: string; week_start: string };

type Step = "form" | "result";

export function NewOrderButton() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [orgId, setOrgId] = useState("");
  const [menuId, setMenuId] = useState("");
  const [sectionsRaw, setSectionsRaw] = useState("Todos");
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{ orderId: string; token: string } | null>(null);

  const formUrl = result
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/pedido/${result.token}`
    : "";

  function handleOpen() {
    setOpen(true);
    setStep("form");
    setResult(null);
    setOrgId("");
    setMenuId("");
    setSectionsRaw("Todos");
    setCopied(false);
    setIsLoading(true);
    getOrgsAndMenusForModal().then((res) => {
      setIsLoading(false);
      if (res.ok) {
        setOrgs(res.data.orgs);
        setMenus(res.data.menus);
      } else {
        toast(res.error, "error");
        setOpen(false);
      }
    });
  }

  function handleClose() {
    setOpen(false);
  }

  function handleSubmit() {
    const sectionNames = sectionsRaw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!orgId) { toast("Seleccioná una organización", "error"); return; }
    if (!menuId) { toast("Seleccioná un menú", "error"); return; }
    if (sectionNames.length === 0) { toast("Ingresá al menos una sección", "error"); return; }

    startTransition(async () => {
      const res = await createManualOrder({ organizationId: orgId, menuId, sectionNames });
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      setResult(res.data);
      setStep("result");
      router.refresh();
    });
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("No se pudo copiar al portapapeles", "error");
    }
  }

  return (
    <>
      <Button size="sm" onClick={handleOpen}>
        <Plus className="h-4 w-4" />
        Nuevo pedido
      </Button>

      <Dialog open={open} onClose={handleClose} title="Crear pedido manual">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-text-secondary">Cargando…</p>
        ) : step === "form" ? (
          <div className="space-y-4">
            {/* Organización */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                Organización
              </label>
              <select
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="">Seleccioná una organización…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            {/* Menú */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                Menú de la semana
              </label>
              {menus.length === 0 ? (
                <p className="text-sm text-text-secondary">No hay menús publicados disponibles.</p>
              ) : (
                <div className="space-y-2">
                  {menus.map((m) => (
                    <label
                      key={m.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                        menuId === m.id
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="menuId"
                        value={m.id}
                        checked={menuId === m.id}
                        onChange={() => setMenuId(m.id)}
                        className="accent-primary"
                      />
                      <span className="text-sm font-medium">{m.week_label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Secciones */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                Secciones <span className="font-normal text-text-secondary">(separar por coma o línea)</span>
              </label>
              <textarea
                value={sectionsRaw}
                onChange={(e) => setSectionsRaw(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none"
                placeholder="Todos, Administración, Ventas…"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={handleClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={isPending || menus.length === 0}>
                {isPending ? "Creando…" : "Crear pedido"}
              </Button>
            </div>
          </div>
        ) : (
          // Step: result
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3">
              <p className="text-sm font-semibold text-green-800">Pedido creado</p>
              <p className="text-xs text-green-700 mt-0.5">
                Compartí el link con la organización para que completen el formulario.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">
                Link del formulario
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={formUrl}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-surface-hover px-3 py-2 text-xs font-mono text-text-secondary"
                />
                <button
                  onClick={handleCopy}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-surface-hover"
                  title="Copiar link"
                >
                  {copied ? (
                    <CheckCheck className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <a
                href={`/pedidos/${result?.orderId}`}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-surface-hover"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver pedido
              </a>
              <Button size="sm" onClick={handleClose}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
