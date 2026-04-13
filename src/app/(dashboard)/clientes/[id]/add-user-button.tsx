"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { addUserToOrgAction } from "../actions";

const ROLE_OPTIONS = [
  { value: "client_admin", label: "Admin cliente" },
  { value: "client_user",  label: "Usuario cliente" },
];

export function AddUserButton({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"client_admin" | "client_user">("client_user");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function reset() {
    setFullName(""); setEmail(""); setPhone(""); setRole("client_user"); setErrors({});
  }

  function handleClose() { reset(); setOpen(false); }

  function validate() {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = "Nombre obligatorio";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Email inválido";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    startTransition(async () => {
      const result = await addUserToOrgAction(orgId, {
        full_name: fullName.trim(),
        email,
        phone: phone.trim() || null,
        role,
      });
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      toast("Usuario agregado", "success");
      handleClose();
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" />
        Agregar usuario
      </Button>

      <Dialog open={open} onClose={handleClose} title="Agregar usuario">
        <div className="space-y-4">
          <Input
            label="Nombre completo *"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={errors.fullName}
            placeholder="Juan Pérez"
          />
          <Input
            label="Email *"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            placeholder="juan@empresa.com"
            helperText="Se usará para el acceso al sistema"
          />
          <Input
            label="Teléfono WhatsApp"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+549XXXXXXXXXX"
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-text">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={handleClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={isPending}>
              Agregar
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
