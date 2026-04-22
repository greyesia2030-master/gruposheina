export default function SharedOrderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b px-4 py-3 sticky top-0 z-10 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D4622B] text-white text-xs font-bold select-none">
          S
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 leading-tight">Grupo Sheina</p>
          <p className="text-xs text-gray-500 leading-tight">Formulario de pedido</p>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-white border-t py-3 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} Grupo Sheina · Todos los derechos reservados
      </footer>
    </div>
  );
}
