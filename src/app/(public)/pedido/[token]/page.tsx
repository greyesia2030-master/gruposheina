export default function PedidoTokenPage({
  params,
}: {
  params: { token: string };
}) {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Formulario de pedido</h1>
      <p className="text-sm text-gray-500">Token: {params.token}</p>
      {/* TODO: validate token, show sections list or redirect to menu */}
    </div>
  );
}
