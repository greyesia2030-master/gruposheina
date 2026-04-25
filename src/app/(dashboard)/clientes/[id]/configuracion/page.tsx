import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ConfiguracionForm } from "./configuracion-form";
import type { Organization } from "@/lib/types/database";

export default async function ConfiguracionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServer();

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .single();

  if (!org) notFound();

  return <ConfiguracionForm org={org as unknown as Organization} />;
}
