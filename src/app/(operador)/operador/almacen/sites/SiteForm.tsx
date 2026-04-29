"use client";

import { useState, useTransition } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createSite, updateSite, toggleSiteActive } from "./actions";
import type { Site, SiteType } from "@/lib/types/database";

const SITE_TYPE_OPTIONS = [
  { value: "warehouse", label: "Almacén" },
  { value: "kitchen", label: "Cocina" },
  { value: "delivery_point", label: "Punto de entrega" },
  { value: "distribution_hub", label: "Hub de distribución" },
];

export function SiteForm({ site }: { site?: Site }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(site?.name ?? "");
  const [siteType, setSiteType] = useState<SiteType>(site?.site_type ?? "warehouse");
  const [address, setAddress] = useState(site?.address ?? "");
  const [phone, setPhone] = useState(site?.contact_phone ?? "");
  const [lat, setLat] = useState(site?.latitude?.toString() ?? "");
  const [lng, setLng] = useState(site?.longitude?.toString() ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function reset() {
    setName(site?.name ?? "");
    setSiteType(site?.site_type ?? "warehouse");
    setAddress(site?.address ?? "");
    setPhone(site?.contact_phone ?? "");
    setLat(site?.latitude?.toString() ?? "");
    setLng(site?.longitude?.toString() ?? "");
    setErrors({});
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Nombre obligatorio";
    if (lat && isNaN(parseFloat(lat))) errs.lat = "Debe ser un número";
    if (lng && isNaN(parseFloat(lng))) errs.lng = "Debe ser un número";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    startTransition(async () => {
      const payload = {
        name: name.trim(),
        site_type: siteType,
        address: address.trim() || null,
        contact_phone: phone.trim() || null,
        latitude: lat ? parseFloat(lat) : null,
        longitude: lng ? parseFloat(lng) : null,
      };
      const result = site ? await updateSite(site.id, payload) : await createSite(payload);
      if (!result.ok) { toast(result.error, "error"); return; }
      toast(site ? "Sitio actualizado" : "Sitio creado", "success");
      setOpen(false);
      if (!site) reset();
    });
  }

  return (
    <>
      <Button size="sm" variant={site ? "outline" : "primary"} onClick={() => setOpen(true)}>
        {site ? "Editar" : "+ Nuevo sitio"}
      </Button>
      <Dialog open={open} onClose={() => { setOpen(false); reset(); }} title={site ? "Editar sitio" : "Nuevo sitio"}>
        <div className="space-y-4">
          <Input id="site-name" label="Nombre *" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
          <Select id="site-type" label="Tipo *" value={siteType} onChange={(e) => setSiteType(e.target.value as SiteType)} options={SITE_TYPE_OPTIONS} />
          <Input id="site-address" label="Dirección" value={address} onChange={(e) => setAddress(e.target.value)} />
          <Input id="site-phone" label="Teléfono de contacto" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input id="site-lat" label="Latitud" value={lat} onChange={(e) => setLat(e.target.value)} error={errors.lat} placeholder="-34.6037" />
            <Input id="site-lng" label="Longitud" value={lng} onChange={(e) => setLng(e.target.value)} error={errors.lng} placeholder="-58.3816" />
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={() => { setOpen(false); reset(); }} disabled={isPending}>Cancelar</Button>
            <Button onClick={handleSubmit} loading={isPending}>{site ? "Guardar cambios" : "Crear sitio"}</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function ToggleSiteButton({ id, isActive }: { id: string; isActive: boolean }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleSiteActive(id, !isActive);
      if (!result.ok) toast(result.error, "error");
      else toast(isActive ? "Sitio desactivado" : "Sitio activado", "success");
    });
  }

  return (
    <Button size="sm" variant="ghost" onClick={handleToggle} loading={isPending}>
      {isActive ? "Desactivar" : "Activar"}
    </Button>
  );
}
