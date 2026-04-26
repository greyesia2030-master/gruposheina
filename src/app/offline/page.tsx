'use client';

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-stone-50">
      <div className="max-w-md text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#D4622B] flex items-center justify-center text-white text-3xl font-bold select-none">
          GS
        </div>
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">
          Sin conexión
        </h1>
        <p className="text-stone-600 mb-6">
          No se puede acceder al servidor en este momento. Tus cambios se guardarán cuando vuelva la red.
        </p>
        <button
          onClick={() => location.reload()}
          className="text-sm underline text-stone-700 hover:text-stone-900 transition-colors"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
