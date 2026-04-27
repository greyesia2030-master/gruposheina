"use client";

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
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <h3 className="text-sm font-medium text-stone-700 mb-4">Viandas por día</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey="dia" stroke="#78716c" fontSize={12} />
          <YAxis stroke="#78716c" fontSize={12} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="viandas" fill="#D4622B" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
