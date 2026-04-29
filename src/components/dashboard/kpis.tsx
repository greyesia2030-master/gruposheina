"use client";

import { motion } from "framer-motion";
import { Package, Utensils, Users, TrendingUp, type LucideIcon } from "lucide-react";
import { fadeInUp, staggerContainer } from "@/lib/design/motion";

function KPICard({
  label,
  value,
  hint,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <motion.div
      variants={fadeInUp}
      className="group bg-white rounded-2xl border border-stone-200/80 p-6 shadow-soft transition-all duration-300 hover:shadow-lift hover:-translate-y-0.5 hover:border-stone-300"
    >
      <div className="flex items-start justify-between mb-4">
        <p className="text-[11px] font-medium uppercase tracking-widest text-stone-500">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} strokeWidth={1.75} />
        </div>
      </div>
      <p className="font-heading text-4xl font-light text-stone-900 leading-none">{value}</p>
      {hint && <p className="text-xs text-stone-500 mt-3">{hint}</p>}
    </motion.div>
  );
}

export function DashboardKPIs(props: {
  activos: number;
  viandas: number;
  clientes: number;
  ticket: number;
}) {
  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <KPICard
        label="Pedidos activos"
        value={props.activos}
        hint="confirmados / en producción"
        icon={Package}
        iconColor="text-sheina-600"
        iconBg="bg-sheina-50"
      />
      <KPICard
        label="Viandas comprometidas"
        value={props.viandas}
        hint="suma activos"
        icon={Utensils}
        iconColor="text-amber-600"
        iconBg="bg-amber-50"
      />
      <KPICard
        label="Clientes activos"
        value={props.clientes}
        hint="últimos 30 días"
        icon={Users}
        iconColor="text-blue-600"
        iconBg="bg-blue-50"
      />
      <KPICard
        label="Ticket promedio"
        value={props.ticket}
        hint="viandas por pedido"
        icon={TrendingUp}
        iconColor="text-emerald-600"
        iconBg="bg-emerald-50"
      />
    </motion.div>
  );
}
