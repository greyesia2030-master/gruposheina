import type { CommunicationTemplate } from "./database";

export interface TemplateWithPreview extends CommunicationTemplate {
  rendered_preview?: string;
}

export interface TemplateRenderContext {
  cliente_nombre?: string;
  member_id?: string;
  numero_pedido?: string;
  semana?: string;
  fecha_entrega?: string;
  total_viandas?: string | number;
  monto_total?: string | number;
  link_formulario?: string;
  link_dashboard?: string;
  valid_until?: string;
  numero_factura?: string;
  fecha_vencimiento?: string;
  admin_nombre?: string;
  seccion_nombre?: string;
}

export function renderTemplate(
  body: string,
  context: TemplateRenderContext
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = (context as Record<string, string | number | undefined>)[key];
    return value !== undefined ? String(value) : match;
  });
}
