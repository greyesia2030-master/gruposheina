export default function PedidoResumenPage({
  params,
}: {
  params: { token: string };
}) {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Resumen de tu pedido</h1>
      <p className="text-sm text-gray-500">Token: {params.token}</p>
      {/* TODO: show cart lines grouped by day, confirm/edit buttons */}
    </div>
  );
}
