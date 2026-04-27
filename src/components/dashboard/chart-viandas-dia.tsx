"use client";

import type { CSSProperties } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export function DashboardChartViandasPorDia({
  data,
}: {
  data: { dia: string; viandas: number }[];
}) {
  return (
    <div
      className="bg-white rounded-2xl border border-stone-200/80 p-6 hover:border-stone-300 transition-colors opacity-0 animate-[fadeInUp_0.4s_ease-out_forwards]"
      style={{ animationDelay: "320ms" } as CSSProperties}
    >
      <h3 className="font-heading text-lg font-medium text-stone-900 mb-1">Viandas por día</h3>
      <p className="text-xs text-stone-500 mb-5">Distribución de la semana actual</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} barCategoryGap="35%">
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
          <XAxis dataKey="dia" stroke="#a8a29e" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#a8a29e" fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid #e7e5e4", fontSize: 12 }}
            cursor={{ fill: "#f5f5f3" }}
          />
          <Bar dataKey="viandas" fill="#D4622B" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
