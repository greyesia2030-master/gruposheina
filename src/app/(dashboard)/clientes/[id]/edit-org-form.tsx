"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { updateOrganizationAction } from "../actions";
import type { Organization } from "@/lib/types/database";

export function EditOrgForm({ org }: { org: Organization }) {
  const [name, setName] = useState(org.name);
  const [cuit, setCuit] = useState(org.cuit ?? "");
  const [phone, setPhone] = useState(org.contact_phone ?? "");
  const [email, setEmail] = useState(org.email ?? "");
  const [address, setAddress] = useState(org.delivery_address ?? "");
  const [price, setPrice] = useState(String(org.price_per_unit ?? 0));
  const [cutoffTime, setCutoffTime] = useState(org.cutoff_time ?? "18:00");
  const [cutoffDays, setCutoffDays] = useState(String(org.cutoff_days_before ?? 1));
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleSave() {
    startTransition(async () => {
      const result = await updateOrganizationAction(org.id, {
        name,
        cuit: cuit || null,
        contact_phone: phone || null,
        email: email || null,
        delivery_address: address || null,
        price_per_unit: Number(price),
        cutoff_time: cutoffTime,
        cutoff_days_before: Number(cutoffDays),
      });
      if (!result.ok) {
        toast(result.error, "error");
      } else {
        toast("Cambios guardados", "success");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Input
        label="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="CUIT"
          value={cuit}
          onChange={(e) => setCuit(e.target.value)}
          placeholder="20-12345678-9"
        />
        <Input
          label="Precio por vianda ($)"
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Teléfono de contacto"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+549XXXXXXXXXX"
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="contacto@empresa.com"
        />
      </div>

      <Input
        label="Dirección de entrega"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Av. Corrientes 123, CABA"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Hora de corte"
          value={cutoffTime}
          onChange={(e) => setCutoffTime(e.target.value)}
          placeholder="18:00"
          helperText="Formato HH:MM"
        />
        <Input
          label="Días antes del corte"
          type="number"
          min="0"
          value={cutoffDays}
          onChange={(e) => setCutoffDays(e.target.value)}
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} loading={isPending}>
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
