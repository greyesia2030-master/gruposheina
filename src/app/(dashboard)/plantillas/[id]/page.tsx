export default function PlantillaPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Plantilla</h1>
      <p className="text-sm text-gray-500">ID: {params.id}</p>
      {/* TODO: template editor with variable preview */}
    </div>
  );
}
