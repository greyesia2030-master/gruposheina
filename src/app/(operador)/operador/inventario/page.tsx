import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServer } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { QuickMovementForm } from "./quick-movement-form";

export default async function OperadorInventarioPage() {
  await requireUser();
  const supabase = await createSupabaseServer();

  const { data: items } = await supabase
    .from("inventory_items")
    .select("id, name, unit, current_stock, min_stock, category")
    .eq("is_active", true)
    .order("name");

  const allItems = items ?? [];
  const lowStockItems = allItems.filter((i) => i.current_stock <= i.min_stock);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-heading font-light text-stone-900 mb-6">Inventario</h1>

      {/* Alertas */}
      {lowStockItems.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">
              {lowStockItems.length} insumo{lowStockItems.length > 1 ? "s" : ""} con stock bajo
            </p>
          </div>
          <ul className="space-y-1">
            {lowStockItems.map((i) => (
              <li key={i.id} className="text-xs text-amber-700">
                {i.name}: {i.current_stock} {i.unit} (mín {i.min_stock})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Formulario de movimiento rápido */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
          Registrar movimiento
        </h2>
        <QuickMovementForm items={allItems.map((i) => ({ id: i.id, name: i.name, unit: i.unit }))} />
      </div>

      {/* Tabla de stock */}
      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
        Stock actual
      </h2>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-stone-400">
                <th className="px-4 py-3 font-medium">Insumo</th>
                <th className="px-4 py-3 font-medium text-right">Stock</th>
                <th className="px-4 py-3 font-medium text-right">Mín</th>
              </tr>
            </thead>
            <tbody>
              {allItems.map((item) => (
                <tr key={item.id} className="border-b border-stone-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-stone-800">{item.name}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${item.current_stock <= item.min_stock ? "text-amber-600" : "text-green-700"}`}>
                    {item.current_stock} {item.unit}
                  </td>
                  <td className="px-4 py-3 text-right text-stone-400">
                    {item.min_stock} {item.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
