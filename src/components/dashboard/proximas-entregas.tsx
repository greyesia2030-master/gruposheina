import Link from "next/link";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Borrador", cls: "bg-stone-100 text-stone-700" },
  awaiting_confirmation: { label: "Esperando", cls: "bg-amber-100 text-amber-800" },
  confirmed: { label: "Confirmado", cls: "bg-blue-100 text-blue-800" },
  in_production: { label: "En producción", cls: "bg-violet-100 text-violet-800" },
  partially_filled: { label: "Parcial", cls: "bg-yellow-100 text-yellow-800" },
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
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-stone-200 flex items-center justify-between">
        <h3 className="text-sm font-medium text-stone-700">Próximas entregas</h3>
        <Link href="/pedidos" className="text-xs text-[#D4622B] hover:underline">
          Ver todos →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-600 text-xs uppercase">
            <tr>
              <th className="px-5 py-2 text-left font-medium">Código</th>
              <th className="px-5 py-2 text-left font-medium">Cliente</th>
              <th className="px-5 py-2 text-left font-medium">Semana</th>
              <th className="px-5 py-2 text-right font-medium">Viandas</th>
              <th className="px-5 py-2 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const s = STATUS_LABELS[o.status] ?? { label: o.status, cls: "bg-stone-100 text-stone-700" };
              const clienteName = (o.organization as { name: string } | null)?.name ?? "—";
              return (
                <tr key={o.id} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/pedidos/${o.id}`}
                      className="font-mono text-xs text-stone-700 hover:text-[#D4622B]"
                    >
                      {o.order_code}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-stone-800">{clienteName}</td>
                  <td className="px-5 py-3 text-stone-600">{o.week_label ?? "—"}</td>
                  <td className="px-5 py-3 text-right font-medium">{o.total_units ?? 0}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${s.cls}`}>
                      {s.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
