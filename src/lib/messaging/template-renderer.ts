import type { CommunicationTemplate } from "@/lib/types/database";

export function renderTemplateString(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? `{{${key}}}`);
}

export function renderTemplate(
  template: CommunicationTemplate,
  variables: Record<string, string>
): { subject: string | null; body: string; bodyHtml: string | null } {
  return {
    subject: template.subject ? renderTemplateString(template.subject, variables) : null,
    body: renderTemplateString(template.body, variables),
    bodyHtml: null,
  };
}
