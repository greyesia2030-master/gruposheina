"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/lib/design/motion";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Borrador", cls: "bg-stone-100 text-stone-600" },
  awaiting_confirmation: { label: "Esperando", cls: "bg-amber-100 text-amber-800" },
  confirmed: { label: "Confirmado", cls: "bg-blue-100 text-blue-800" },
  in_production: { label: "En producción", cls: "bg-sheina-100 text-sheina-800" },
  partially_filled: { label: "Parcial", cls: "bg-yellow-100 text-yellow-800" },
  delivered: { label: "Entregado", cls: "bg-stone-100 text-stone-400" },
};

interface Order {
  id: string;
  order_code: string;
  status: string;
  total_units: number | null;
  week_label: string | null;
  organization: unknown;
}

export function DashboardProximasEntregas({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 text-center text-stone-500 text-sm">
        Sin entregas próximas
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-soft overflow-hidden">
      <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
        <h3 className="font-heading text-lg font-medium text-stone-900">Próximas entregas</h3>
        <Link href="/pedidos" className="text-xs text-sheina-600 hover:text-sheina-700 transition-colors">
          Ver todos →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
            <tr>
              <th className="px-5 py-2.5 text-left font-medium tracking-wide">Código</th>
              <th className="px-5 py-2.5 text-left font-medium tracking-wide">Cliente</th>
              <th className="px-5 py-2.5 text-left font-medium tracking-wide">Semana</th>
              <th className="px-5 py-2.5 text-right font-medium tracking-wide">Viandas</th>
              <th className="px-5 py-2.5 text-left font-medium tracking-wide">Estado</th>
            </tr>
          </thead>
          <motion.tbody
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {orders.map((o) => {
              const s =
                STATUS_LABELS[o.status] ?? { label: o.status, cls: "bg-stone-100 text-stone-700" };
              const clienteName =
                (o.organization as { name: string } | null)?.name ?? "—";
              const isDelivered = o.status === "delivered";
              return (
                <motion.tr
                  key={o.id}
                  variants={fadeInUp}
                  className="border-t border-stone-100 hover:bg-sheina-50/40 transition-colors cursor-pointer group"
                >
                  <td className="p-0">
                    <Link
                      href={`/pedidos/${o.id}`}
                      className="block px-5 py-3 font-mono text-xs text-stone-600 group-hover:text-sheina-600 transition-colors"
                    >
                      {o.order_code}
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      href={`/pedidos/${o.id}`}
                      className={`block px-5 py-3 font-medium ${isDelivered ? "text-stone-400 line-through decoration-stone-300" : "text-stone-800"}`}
                    >
                      {clienteName}
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link href={`/pedidos/${o.id}`} className="block px-5 py-3 text-stone-500">
                      {o.week_label ?? "—"}
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link
                      href={`/pedidos/${o.id}`}
                      className="block px-5 py-3 text-right font-medium text-stone-800"
                    >
                      {o.total_units ?? 0}
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link href={`/pedidos/${o.id}`} className="block px-5 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}
                      >
                        {s.label}
                      </span>
                    </Link>
                  </td>
                </motion.tr>
              );
            })}
          </motion.tbody>
        </table>
      </div>
    </div>
  );
}
