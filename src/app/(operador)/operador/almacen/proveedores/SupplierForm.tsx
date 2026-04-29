"use client";

import { useState, useTransition } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createSupplier, updateSupplier, toggleSupplierActive } from "./actions";
import type { Supplier } from "@/lib/types/database";

export function SupplierForm({ supplier }: { supplier?: Supplier }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(supplier?.name ?? "");
  const [cuit, setCuit] = useState(supplier?.cuit ?? "");
  const [contactName, setContactName] = useState(supplier?.contact_name ?? "");
  const [phone, setPhone] = useState(supplier?.contact_phone ?? "");
  const [email, setEmail] = useState(supplier?.contact_email ?? "");
  const [paymentTerms, setPaymentTerms] = useState(supplier?.payment_terms ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function reset() {
    setName(supplier?.name ?? "");
    setCuit(supplier?.cuit ?? "");
    setContactName(supplier?.contact_name ?? "");
    setPhone(supplier?.contact_phone ?? "");
    setEmail(supplier?.contact_email ?? "");
    setPaymentTerms(supplier?.payment_terms ?? "");
    setNotes(supplier?.notes ?? "");
    setErrors({});
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Nombre obligatorio";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Email inválido";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    startTransition(async () => {
      const payload = {
        name: name.trim(),
        cuit: cuit.trim() || null,
        contact_name: contactName.trim() || null,
        contact_phone: phone.trim() || null,
        contact_email: email.trim() || null,
        payment_terms: paymentTerms.trim() || null,
        notes: notes.trim() || null,
      };
      const result = supplier
        ? await updateSupplier(supplier.id, payload)
        : await createSupplier(payload);
      if (!result.ok) { toast(result.error, "error"); return; }
      toast(supplier ? "Proveedor actualizado" : "Proveedor creado", "success");
      setOpen(false);
      if (!supplier) reset();
    });
  }

  return (
    <>
      <Button size="sm" variant={supplier ? "outline" : "primary"} onClick={() => setOpen(true)}>
        {supplier ? "Editar" : "+ Nuevo proveedor"}
      </Button>
      <Dialog open={open} onClose={() => { setOpen(false); reset(); }} title={supplier ? "Editar proveedor" : "Nuevo proveedor"}>
        <div className="space-y-4">
          <Input id="sup-name" label="Nombre *" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
          <Input id="sup-cuit" label="CUIT" value={cuit} onChange={(e) => setCuit(e.target.value)} placeholder="30-12345678-9" />
          <Input id="sup-contact-name" label="Nombre de contacto" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          <Input id="sup-phone" label="Teléfono de contacto" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input id="sup-email" label="Email de contacto" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
          <Input id="sup-payment" label="Condiciones de pago" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="30 días, contado, etc." />
          <div>
            <label htmlFor="sup-notes" className="mb-1 block text-sm font-medium text-text">Notas</label>
            <textarea
              id="sup-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={() => { setOpen(false); reset(); }} disabled={isPending}>Cancelar</Button>
            <Button onClick={handleSubmit} loading={isPending}>{supplier ? "Guardar cambios" : "Crear proveedor"}</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function ToggleSupplierButton({ id, isActive }: { id: string; isActive: boolean }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleSupplierActive(id, !isActive);
      if (!result.ok) toast(result.error, "error");
      else toast(isActive ? "Proveedor desactivado" : "Proveedor activado", "success");
    });
  }

  return (
    <Button size="sm" variant="ghost" onClick={handleToggle} loading={isPending}>
      {isActive ? "Desactivar" : "Activar"}
    </Button>
  );
}
