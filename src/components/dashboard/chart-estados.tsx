"use client";

import type { CSSProperties } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  draft:                 "#a8a29e",
  awaiting_confirmation: "#f59e0b",
  confirmed:             "#3b82f6",
  in_production:         "#8b5cf6",
  partially_filled:      "#eab308",
  delivered:             "#10b981",
  cancelled:             "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  draft:                 "Borrador",
  awaiting_confirmation: "Esp. confirmación",
  confirmed:             "Confirmado",
  in_production:         "En producción",
  partially_filled:      "Parcial",
  delivered:             "Entregado",
  cancelled:             "Cancelado",
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
    <div
      className="bg-white rounded-2xl border border-stone-200/80 p-6 hover:border-stone-300 transition-colors opacity-0 animate-[fadeInUp_0.4s_ease-out_forwards]"
      style={{ animationDelay: "400ms" } as CSSProperties}
    >
      <h3 className="font-heading text-lg font-medium text-stone-900 mb-1">Pedidos por estado</h3>
      <p className="text-xs text-stone-500 mb-5">Distribución actual del pipeline</p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={formatted}
            dataKey="cantidad"
            nameKey="label"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
          >
            {formatted.map((d, i) => (
              <Cell key={i} fill={STATUS_COLORS[d.estado] ?? "#a8a29e"} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e7e5e4", fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
