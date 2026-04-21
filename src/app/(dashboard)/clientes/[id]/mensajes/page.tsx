export default function ClienteMensajesPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Mensajes del cliente</h1>
      <p className="text-sm text-gray-500">Cliente: {params.id}</p>
      {/* TODO: communications filtered by organization_id */}
    </div>
  );
}
