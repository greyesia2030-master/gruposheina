export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatART } from "@/lib/utils/timezone";
import type { ConversationLog } from "@/lib/types/database";
import { ArrowDown, ArrowUp, FileSpreadsheet, CheckCircle, XCircle, HelpCircle, MessageSquare } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  EXCEL_FILE:    "Excel",
  INVALID_FILE:  "Archivo inválido",
  CONFIRM:       "Confirmar",
  CANCEL:        "Cancelar",
  REPLACE:       "Reemplazar",
  STATUS:        "Estado",
  MENU:          "Menú",
  DETAIL:        "Detalle",
  HELP:          "Ayuda",
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  EXCEL_FILE:    <FileSpreadsheet className="h-3.5 w-3.5" />,
  CONFIRM:       <CheckCircle className="h-3.5 w-3.5 text-green-600" />,
  CANCEL:        <XCircle className="h-3.5 w-3.5 text-red-600" />,
  HELP:          <HelpCircle className="h-3.5 w-3.5" />,
};

function groupByDate(logs: ConversationLog[]): Record<string, ConversationLog[]> {
  return logs.reduce<Record<string, ConversationLog[]>>((acc, log) => {
    const date = log.created_at.slice(0, 10);
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {});
}

export default async function ConversacionesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServer();

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", id)
    .single();

  if (!org) notFound();

  // Obtener teléfonos vinculados a la organización
  const { data: orgUsers } = await supabase
    .from("users")
    .select("phone")
    .eq("organization_id", id)
    .not("phone", "is", null);

  const phones = (orgUsers ?? []).map((u) => u.phone).filter(Boolean) as string[];

  // Variantes argentinas: incluir +54 y +549 para cada teléfono
  const allPhones = [...new Set(
    phones.flatMap((p) => {
      if (p.startsWith("+549")) return [p, "+54" + p.slice(4)];
      if (p.startsWith("+54") && !p.startsWith("+549")) return [p, "+549" + p.slice(3)];
      return [p];
    })
  )];

  let logs: ConversationLog[] = [];
  if (allPhones.length > 0) {
    const { data } = await supabase
      .from("conversation_logs")
      .select("*")
      .in("phone", allPhones)
      .neq("message_type", "__state__")
      .order("created_at", { ascending: false })
      .limit(200);
    logs = (data ?? []) as ConversationLog[];
  }

  const grouped = groupByDate(logs);
  const dates = Object.keys(grouped).sort().reverse();

  return (
    <div>
      <PageHeader
        title="Conversaciones"
        breadcrumbs={[
          { label: "Clientes", href: "/clientes" },
          { label: org.name, href: `/clientes/${id}` },
          { label: "Conversaciones" },
        ]}
      />

      {phones.length === 0 ? (
        <Card>
          <p className="p-8 text-center text-text-secondary">
            No hay usuarios con teléfono vinculado a esta organización.
          </p>
        </Card>
      ) : logs.length === 0 ? (
        <Card>
          <p className="p-8 text-center text-text-secondary">
            Sin conversaciones registradas todavía.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {dates.map((date) => (
            <div key={date}>
              <div className="mb-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-text-secondary">
                  {formatART(date + "T12:00:00", "EEEE d 'de' MMMM yyyy")}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-2">
                {grouped[date].map((log) => (
                  <div
                    key={log.id}
                    className={`flex gap-3 ${log.direction === "out" ? "flex-row-reverse" : ""}`}
                  >
                    {/* Ícono de dirección */}
                    <div className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      log.direction === "in" ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary"
                    }`}>
                      {log.direction === "in"
                        ? <ArrowDown className="h-3 w-3" />
                        : <ArrowUp className="h-3 w-3" />
                      }
                    </div>

                    {/* Burbuja de mensaje */}
                    <div className={`max-w-[70%] rounded-xl px-3 py-2 text-sm ${
                      log.direction === "in"
                        ? "rounded-tl-none bg-surface"
                        : "rounded-tr-none bg-primary/10"
                    }`}>
                      {/* Header de la burbuja */}
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-mono text-xs text-text-secondary">{log.phone}</span>
                        {log.message_type && log.message_type !== "__state__" && (
                          <span className="flex items-center gap-0.5 text-xs text-text-secondary">
                            {TYPE_ICON[log.message_type]}
                            {TYPE_LABELS[log.message_type] ?? log.message_type}
                          </span>
                        )}
                        {log.order_id && (
                          <Link
                            href={`/pedidos/${log.order_id}`}
                            className="text-xs text-primary hover:underline"
                          >
                            Ver pedido
                          </Link>
                        )}
                      </div>

                      {/* Cuerpo */}
                      {log.body ? (
                        <p className="whitespace-pre-wrap text-sm">{log.body}</p>
                      ) : log.media_url ? (
                        <div className="flex items-center gap-1 text-text-secondary">
                          <FileSpreadsheet className="h-4 w-4" />
                          <span>Archivo adjunto</span>
                        </div>
                      ) : (
                        <span className="text-text-secondary italic">—</span>
                      )}

                      {/* Timestamp */}
                      <p className="mt-1 text-right text-xs text-text-secondary">
                        {formatART(log.created_at, "HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
