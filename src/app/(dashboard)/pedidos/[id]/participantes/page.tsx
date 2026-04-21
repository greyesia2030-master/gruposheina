export default function ParticipantesPedidoPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Participantes</h1>
      <p className="text-sm text-gray-500">Pedido: {params.id}</p>
      {/* TODO: list order_participants with submission status per section */}
    </div>
  );
}
