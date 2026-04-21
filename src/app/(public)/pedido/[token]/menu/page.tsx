export default function PedidoMenuPage({
  params,
}: {
  params: { token: string };
}) {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Elegí tu menú</h1>
      <p className="text-sm text-gray-500">Token: {params.token}</p>
      {/* TODO: render weekly menu items with quantity selectors per day */}
    </div>
  );
}
