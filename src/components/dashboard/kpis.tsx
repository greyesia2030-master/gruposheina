function KPICard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <p className="text-xs text-stone-500 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-3xl font-bold text-stone-900 mt-2">{value}</p>
      {hint && <p className="text-xs text-stone-400 mt-1">{hint}</p>}
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard label="Pedidos activos" value={props.activos} hint="confirmados / en producción" />
      <KPICard label="Viandas comprometidas" value={props.viandas} hint="suma activos" />
      <KPICard label="Clientes activos" value={props.clientes} hint="últimos 30 días" />
      <KPICard label="Ticket promedio" value={`${props.ticket} viandas`} />
    </div>
  );
}
