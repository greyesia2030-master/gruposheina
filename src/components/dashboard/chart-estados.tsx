"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  draft: "#a8a29e",
  awaiting_confirmation: "#f59e0b",
  confirmed: "#3b82f6",
  in_production: "#8b5cf6",
  partially_filled: "#eab308",
  delivered: "#10b981",
  cancelled: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  awaiting_confirmation: "Esp. confirmación",
  confirmed: "Confirmado",
  in_production: "En producción",
  partially_filled: "Parcial",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export function DashboardChartEstados({
  data,
}: {
  data: { estado: string; cantidad: number }[];
}) {
  const formatted = data.map((d) => ({
    ...d,
    label: STATUS_LABELS[d.estado] ?? d.estado,
  }));

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <h3 className="text-sm font-medium text-stone-700 mb-4">Pedidos por estado</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={formatted}
            dataKey="cantidad"
            nameKey="label"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
          >
            {formatted.map((d, i) => (
              <Cell key={i} fill={STATUS_COLORS[d.estado] ?? "#78716c"} />
            ))}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
