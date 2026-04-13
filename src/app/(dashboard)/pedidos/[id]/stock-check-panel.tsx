import { CheckCircle, AlertTriangle } from "lucide-react";
import type { StockCheckResult } from "@/app/actions/orders";

interface StockCheckPanelProps {
  result: StockCheckResult;
}

export function StockCheckPanel({ result }: StockCheckPanelProps) {
  if (result.checkedItems === 0) return null;

  if (result.canProduce) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">
        <CheckCircle className="h-4 w-4 shrink-0" />
        <span>Stock suficiente para producir ({result.checkedItems} insumos verificados)</span>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Stock insuficiente — {result.shortages.length} insumo
          {result.shortages.length !== 1 ? "s" : ""} con faltante
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-amber-700">
              <th className="pb-1 pr-3 font-medium">Insumo</th>
              <th className="pb-1 pr-3 text-right font-medium">Necesario</th>
              <th className="pb-1 pr-3 text-right font-medium">Disponible</th>
              <th className="pb-1 text-right font-medium">Faltante</th>
            </tr>
          </thead>
          <tbody>
            {result.shortages.map((s) => (
              <tr key={s.inventoryItemId} className="border-t border-amber-100">
                <td className="py-1 pr-3 font-medium text-amber-900">{s.name}</td>
                <td className="py-1 pr-3 text-right text-amber-800">
                  {s.needed.toFixed(2)} {s.unit}
                </td>
                <td className="py-1 pr-3 text-right text-amber-800">
                  {s.available.toFixed(2)} {s.unit}
                </td>
                <td className="py-1 text-right font-semibold text-red-700">
                  {s.deficit.toFixed(2)} {s.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
