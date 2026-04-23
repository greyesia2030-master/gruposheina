import { createSupabaseServer } from "@/lib/supabase/server";
import Link from "next/link";

const DAY_NAMES: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
};

export default async function ParticipantesPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createSupabaseServer();

  const { data: sections } = await supabase
    .from("order_sections")
    .select(`
      id, name, closed_at, total_quantity, display_order,
      order_participants(
        id, display_name, submitted_at, total_quantity,
        order_lines(id, quantity, day_of_week, display_name)
      )
    `)
    .eq("order_id", params.id)
    .order("display_order");

  const sectionList = (sections ?? []) as unknown as Array<{
    id: string;
    name: string;
    closed_at: string | null;
    total_quantity: number;
    display_order: number;
    order_participants: Array<{
      id: string;
      display_name: string;
      submitted_at: string | null;
      total_quantity: number;
      order_lines: Array<{
        id: string;
        quantity: number;
        day_of_week: number;
        display_name: string;
      }>;
    }>;
  }>;

  const totalParticipants = sectionList.reduce(
    (s, sec) => s + sec.order_participants.length,
    0
  );

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Participantes del pedido</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalParticipants} participante{totalParticipants !== 1 ? "s" : ""} en{" "}
            {sectionList.length} sector{sectionList.length !== 1 ? "es" : ""}
          </p>
        </div>
        <Link
          href={`/pedidos/${params.id}/compartir`}
          className="text-sm text-[#D4622B] hover:underline"
        >
          ← Ver link compartido
        </Link>
      </div>

      {sectionList.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-sm">
            Aún no se generó el link colaborativo para este pedido.
          </p>
          <Link
            href={`/pedidos/${params.id}/compartir`}
            className="mt-3 inline-block text-sm text-[#D4622B] hover:underline"
          >
            Generar link →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {sectionList.map((section) => (
            <div key={section.id} className="border rounded-xl overflow-hidden">
              {/* Section header */}
              <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
                <div>
                  <span className="font-semibold text-gray-900">{section.name}</span>
                  <span className="ml-2 text-sm text-gray-500">
                    {section.order_participants.length} participante
                    {section.order_participants.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {section.total_quantity > 0 && (
                    <span className="text-sm text-gray-600">
                      {section.total_quantity} viandas
                    </span>
                  )}
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      section.closed_at
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {section.closed_at ? "Cerrado" : "Abierto"}
                  </span>
                </div>
              </div>

              {/* Participants */}
              {section.order_participants.length === 0 ? (
                <div className="px-4 py-6 text-center text-gray-400 text-sm">
                  Nadie se unió a este sector todavía
                </div>
              ) : (
                <div className="divide-y">
                  {section.order_participants.map((participant) => {
                    const byDay = participant.order_lines.reduce<
                      Record<number, typeof participant.order_lines>
                    >((acc, l) => {
                      (acc[l.day_of_week] ??= []).push(l);
                      return acc;
                    }, {});

                    return (
                      <div key={participant.id} className="px-4 py-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-gray-900">
                            {participant.display_name}
                          </p>
                          <div className="flex items-center gap-2">
                            {participant.total_quantity > 0 && (
                              <span className="text-xs text-gray-500">
                                {participant.total_quantity} viandas
                              </span>
                            )}
                            {participant.submitted_at ? (
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                                Confirmado
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                                Pendiente
                              </span>
                            )}
                          </div>
                        </div>

                        {participant.order_lines.length === 0 ? (
                          <p className="text-sm text-gray-400">Sin viandas cargadas</p>
                        ) : (
                          <div className="space-y-1">
                            {Object.entries(byDay)
                              .sort(([a], [b]) => Number(a) - Number(b))
                              .map(([dayNum, lines]) => (
                                <div key={dayNum}>
                                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-2 mb-1">
                                    {DAY_NAMES[Number(dayNum)]}
                                  </p>
                                  {lines.map((line) => (
                                    <div
                                      key={line.id}
                                      className="flex justify-between text-sm text-gray-600 py-0.5"
                                    >
                                      <span>{line.display_name}</span>
                                      <span className="font-medium text-gray-900">
                                        {line.quantity}×
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
