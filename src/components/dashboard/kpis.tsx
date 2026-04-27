import type { CSSProperties } from "react";

function KPICard({
  label,
  value,
  hint,
  delay,
}: {
  label: string;
  value: string | number;
  hint?: string;
  delay: number;
}) {
  return (
    <div
      className="group bg-white rounded-2xl border border-stone-200/80 p-6 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-stone-300 opacity-0 animate-[fadeInUp_0.4s_ease-out_forwards]"
      style={{ animationDelay: `${delay}ms` } as CSSProperties}
    >
      <p className="text-[11px] font-medium uppercase tracking-widest text-stone-500 mb-3">{label}</p>
      <p className="font-heading text-4xl font-light text-stone-900 leading-none">{value}</p>
      {hint && <p className="text-xs text-stone-500 mt-3">{hint}</p>}
    </div>
  );
}

export function DashboardKPIs(props: {
  activos: number;
  viandas: number;
  clientes: number;
  ticket: number;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      <KPICard label="Pedidos activos"      value={props.activos}  hint="confirmados / en producción" delay={0} />
      <KPICard label="Viandas comprometidas" value={props.viandas}  hint="suma activos"                delay={80} />
      <KPICard label="Clientes activos"      value={props.clientes} hint="últimos 30 días"             delay={160} />
      <KPICard label="Ticket promedio"       value={props.ticket}   hint="viandas por pedido"          delay={240} />
    </div>
  );
}
