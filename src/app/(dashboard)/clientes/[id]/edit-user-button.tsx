"use client";

import { useState, useTransition } from "react";
import { Pencil, KeyRound } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { updateClientUserAction, resetClientUserPasswordAction } from "../actions";

const ROLE_OPTIONS = [
  { value: "client_admin", label: "Admin cliente" },
  { value: "client_user",  label: "Usuario cliente" },
];

interface UserRow {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
}

export function EditUserButton({ user, orgId }: { user: UserRow; orgId: string }) {
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [role, setRole] = useState<"client_admin" | "client_user">(
    user.role as "client_admin" | "client_user"
  );
  const [isActive, setIsActive] = useState(user.is_active);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  function validateEdit() {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = "Nombre obligatorio";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Email inválido";
    setEditErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleEditSubmit() {
    if (!validateEdit()) return;
    startTransition(async () => {
      const result = await updateClientUserAction(user.id, orgId, {
        full_name: fullName.trim(),
        email,
        phone: phone.trim() || null,
        role,
        is_active: isActive,
      });
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      toast("Usuario actualizado", "success");
      setEditOpen(false);
    });
  }

  function handlePasswordSubmit() {
    if (newPassword.length < 8) {
      setPasswordError("Mínimo 8 caracteres");
      return;
    }
    setPasswordError("");
    startTransition(async () => {
      const result = await resetClientUserPasswordAction(user.id, orgId, newPassword);
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      toast("Contraseña actualizada. El usuario ya puede ingresar.", "success");
      setNewPassword("");
      setPasswordOpen(false);
    });
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setEditOpen(true)}
          className="rounded p-1 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
          title="Editar usuario"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => { setNewPassword(""); setPasswordError(""); setPasswordOpen(true); }}
          className="rounded p-1 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
          title="Restablecer contraseña"
        >
          <KeyRound className="h-3.5 w-3.5" />
        </button>
      </div>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Editar usuario">
        <div className="space-y-4">
          <Input
            label="Nombre completo *"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={editErrors.fullName}
            placeholder="Juan Pérez"
          />
          <Input
            label="Email *"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={editErrors.email}
            placeholder="juan@empresa.com"
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
          <label className="flex cursor-pointer select-none items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded accent-primary"
            />
            <span className="text-sm text-text">Usuario activo</span>
          </label>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handleEditSubmit} loading={isPending}>
              Guardar cambios
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={passwordOpen} onClose={() => setPasswordOpen(false)} title="Restablecer contraseña">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Establecé una nueva contraseña para{" "}
            <strong>{user.full_name ?? user.email}</strong>.{" "}
            Si el usuario no tenía acceso aún, se creará su cuenta automáticamente.
          </p>
          <Input
            label="Nueva contraseña *"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            error={passwordError}
            placeholder="Mínimo 8 caracteres"
          />
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={() => setPasswordOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handlePasswordSubmit} loading={isPending}>
              Restablecer
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
