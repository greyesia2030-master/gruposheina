import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getClientDepartments } from "@/app/actions/client-departments";
import { DepartamentosClient } from "./departamentos-client";
import type { Organization, ClientDepartment } from "@/lib/types/database";

export default async function DepartamentosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServer();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, departments")
    .eq("id", id)
    .single();

  if (!org) notFound();

  const deptResult = await getClientDepartments(id);
  const departments = deptResult.ok ? deptResult.data : [];

  return (
    <DepartamentosClient
      org={org as unknown as Pick<Organization, "id" | "name" | "departments">}
      departments={departments as ClientDepartment[]}
    />
  );
}
