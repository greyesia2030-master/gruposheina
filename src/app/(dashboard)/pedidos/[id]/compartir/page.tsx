export default function CompartirPedidoPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Compartir pedido</h1>
      <p className="text-sm text-gray-500">Pedido: {params.id}</p>
      {/* TODO: create/manage order_form_tokens for this order */}
    </div>
  );
}
