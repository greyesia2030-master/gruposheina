import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-xl font-semibold">Página no encontrada</h2>
      <p className="text-sm text-text-secondary">
        La página que buscás no existe o fue movida.
      </p>
      <Link
        href="/pedidos"
        className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
      >
        Volver a Pedidos
      </Link>
    </div>
  );
}
