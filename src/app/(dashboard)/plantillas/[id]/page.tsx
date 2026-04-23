import { createSupabaseServer } from "@/lib/supabase/server";
import { PlantillaEditor } from "./plantilla-editor";
import type { CommunicationTemplate } from "@/lib/types/database";

export default async function PlantillaPage({
  params,
}: {
  params: { id: string };
}) {
  const isNew = params.id === "nueva";
  let template: CommunicationTemplate | null = null;

  if (!isNew) {
    const supabase = await createSupabaseServer();
    const { data } = await supabase
      .from("communication_templates")
      .select("*")
      .eq("id", params.id)
      .single();
    template = data as unknown as CommunicationTemplate | null;
  }

  return <PlantillaEditor template={template} templateId={isNew ? null : params.id} />;
}
