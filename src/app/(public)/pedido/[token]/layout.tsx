import { OrderContextHeader } from "@/components/public/order-context-header";

export default async function SharedOrderLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <OrderContextHeader token={token} />
      <main className="flex-1">{children}</main>
      <footer className="bg-white border-t py-3 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} Grupo Sheina · Todos los derechos reservados
      </footer>
    </div>
  );
}
