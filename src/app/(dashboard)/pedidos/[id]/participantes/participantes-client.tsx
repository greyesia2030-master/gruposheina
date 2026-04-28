"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { deleteParticipant } from "@/app/actions/admin-overrides";
import { EditParticipantModal } from "@/components/admin/edit-participant-modal";

const DAY_NAMES: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `hace ${hours}h`;
  return new Date(date).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Participant = {
  id: string;
  display_name: string;
  submitted_at: string | null;
  total_quantity: number;
  last_activity_at: string;
  member_contact: string | null;
  contact_type: "email" | "phone" | "none";
  is_authorized: boolean | null;
  order_lines: Array<{
    id: string;
    quantity: number;
    day_of_week: number;
    display_name: string;
    menu_item_id: string;
  }>;
};

type Section = {
  id: string;
  name: string;
  closed_at: string | null;
  total_quantity: number;
  display_order: number;
  order_participants: Participant[];
};

type SortKey = "recent" | "name" | "quantity";

export function ParticipantesClient({
  orderId,
  sectionList,
}: {
  orderId: string;
  sectionList: Section[];
}) {
  const [sectionFilter, setSectionFilter] = useState("__all__");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (participant: Participant) => {
    if (!confirm(`¿Eliminar a ${participant.display_name}? Esta acción no se puede deshacer.`)) return;
    setDeletingId(participant.id);
    await deleteParticipant(orderId, participant.id);
    setDeletingId(null);
    window.location.reload();
  };

  const AuthBadge = ({ p }: { p: Participant }) => {
    if (p.contact_type === "none" || !p.member_contact) return null;
    if (p.is_authorized === true)
      return (
        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full" title={p.member_contact}>
          🟢 Verificado
        </span>
      );
    if (p.is_authorized === false)
      return (
        <span
          className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full cursor-help"
          title={`${p.member_contact} — El email no está en la whitelist autorizada de este sector. Verificá si corresponde.`}
        >
          Fuera de whitelist
        </span>
      );
    return (
      <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full" title={p.member_contact}>
        🟡 Sin verificar
      </span>
    );
  };

  const sectionNames = useMemo(
    () => [...new Set(sectionList.map((s) => s.name))],
    [sectionList]
  );

  const totalParticipants = sectionList.reduce(
    (s, sec) => s + sec.order_participants.length,
    0
  );

  const filteredSections = useMemo(() => {
    const sections =
      sectionFilter === "__all__"
        ? sectionList
        : sectionList.filter((s) => s.name === sectionFilter);

    return sections.map((sec) => ({
      ...sec,
      order_participants: [...sec.order_participants].sort((a, b) => {
        if (sortKey === "name") return a.display_name.localeCompare(b.display_name, "es");
        if (sortKey === "quantity") return b.total_quantity - a.total_quantity;
        return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime();
      }),
    }));
  }, [sectionList, sectionFilter, sortKey]);

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
          href={`/pedidos/${orderId}/compartir`}
          className="text-sm text-[#D4622B] hover:underline"
        >
          ← Ver link compartido
        </Link>
      </div>

      {sectionList.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-sm">Aún no se generó el link colaborativo para este pedido.</p>
          <Link
            href={`/pedidos/${orderId}/compartir`}
            className="mt-3 inline-block text-sm text-[#D4622B] hover:underline"
          >
            Generar link →
          </Link>
        </div>
      ) : (
        <>
          {/* Filtros */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Sector
              </label>
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#D4622B]"
              >
                <option value="__all__">Todos</option>
                {sectionNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Orden
              </label>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#D4622B]"
              >
                <option value="recent">Más reciente</option>
                <option value="name">Nombre A-Z</option>
                <option value="quantity">Cantidad descendente</option>
              </select>
            </div>
          </div>

          <div className="space-y-6">
            {filteredSections.map((section) => (
              <div key={section.id} className="border rounded-xl overflow-hidden">
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
                          <div className="flex items-center justify-between mb-1">
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
                              <button
                                onClick={() => setEditingParticipant(participant)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                                title="Editar aporte"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(participant)}
                                disabled={deletingId === participant.id}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                                title="Eliminar participante"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-xs text-gray-400">
                              {timeAgo(participant.last_activity_at)}
                            </p>
                            <AuthBadge p={participant} />
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
        </>
      )}

      {editingParticipant && (
        <EditParticipantModal
          open={!!editingParticipant}
          onClose={() => setEditingParticipant(null)}
          onSaved={() => window.location.reload()}
          orderId={orderId}
          participant={editingParticipant}
        />
      )}
    </div>
  );
}
