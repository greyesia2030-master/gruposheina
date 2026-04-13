"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createOrganizationAction } from "./actions";

const DEFAULT_DEPARTMENTS = ["adm", "vtas", "diet", "log", "otros"];

export function NewClientButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  // Form state
  const [name, setName] = useState("");
  const [cuit, setCuit] = useState("");
  const [phone, setPhone] = useState("+549");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [deptInput, setDeptInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function resetForm() {
    setName(""); setCuit(""); setPhone("+549"); setEmail("");
    setAddress(""); setPrice(""); setDepartments(DEFAULT_DEPARTMENTS);
    setDeptInput(""); setErrors({});
  }

  function handleClose() {
    resetForm();
    setOpen(false);
  }

  function addDept() {
    const v = deptInput.trim().toLowerCase();
    if (v && !departments.includes(v)) {
      setDepartments([...departments, v]);
    }
    setDeptInput("");
  }

  function removeDept(dept: string) {
    setDepartments(departments.filter((d) => d !== dept));
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Nombre obligatorio";
    if (!/^\+549\d{10}$/.test(phone)) errs.phone = "Formato inválido. Usá +549XXXXXXXXXX";
    if (!price || isNaN(Number(price)) || Number(price) <= 0) errs.price = "Precio obligatorio";
    if (departments.length === 0) errs.departments = "Al menos un departamento";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Email inválido";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    startTransition(async () => {
      const result = await createOrganizationAction({
        name: name.trim(),
        cuit: cuit.trim() || undefined,
        contact_phone: phone,
        email: email || undefined,
        delivery_address: address.trim() || undefined,
        price_per_unit: Number(price),
        departments,
      });
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      toast("Cliente creado exitosamente", "success");
      handleClose();
      router.push(`/clientes/${result.id}`);
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Nuevo cliente
      </Button>

      <Dialog open={open} onClose={handleClose} title="Nuevo cliente">
        <div className="space-y-4">
          <Input
            label="Nombre *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            placeholder="Empresa S.A."
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="CUIT"
              value={cuit}
              onChange={(e) => setCuit(e.target.value)}
              placeholder="20-12345678-9"
            />
            <Input
              label="Precio por vianda *"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              error={errors.price}
              placeholder="850"
            />
          </div>

          <Input
            label="Teléfono WhatsApp *"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={errors.phone}
            placeholder="+5491155556666"
            helperText="Formato: +549 + 10 dígitos"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              placeholder="admin@empresa.com"
            />
            <Input
              label="Dirección de entrega"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Av. Corrientes 123"
            />
          </div>

          {/* Departments chips */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text">
              Departamentos *
            </label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {departments.map((dept) => (
                <span
                  key={dept}
                  className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                >
                  {dept}
                  <button
                    type="button"
                    onClick={() => removeDept(dept)}
                    className="ml-0.5 rounded-full hover:bg-primary/20 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={deptInput}
                onChange={(e) => setDeptInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addDept();
                  }
                }}
                placeholder="Agregar departamento..."
                className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <Button type="button" variant="outline" size="sm" onClick={addDept}>
                Agregar
              </Button>
            </div>
            {errors.departments && (
              <p className="mt-1 text-xs text-error">{errors.departments}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={handleClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={isPending}>
              Crear cliente
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
