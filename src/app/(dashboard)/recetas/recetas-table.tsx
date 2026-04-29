"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS } from "@/lib/types/menus";
import { fadeInUp, staggerContainer } from "@/lib/design/motion";
import type { MenuCategory } from "@/lib/types/database";

export type RecipeTableRow = {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
  version: number | null;
  costPerPortion: number;
  portionsYield: number | null;
};

export function RecetasTable({ rows }: { rows: RecipeTableRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-stone-50 border-b border-stone-200 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3">Categoría</th>
            <th className="px-4 py-3">Versión</th>
            <th className="px-4 py-3">Rendimiento</th>
            <th className="px-4 py-3 text-right">Costo/porción</th>
            <th className="px-4 py-3">Estado</th>
          </tr>
        </thead>
        <motion.tbody variants={staggerContainer} initial="hidden" animate="visible">
          {rows.map((recipe) => (
            <motion.tr
              key={recipe.id}
              variants={fadeInUp}
              className="border-b border-stone-100 last:border-0 hover:bg-sheina-50/40 transition-colors cursor-pointer"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/recetas/${recipe.id}`}
                  className="font-medium hover:text-sheina-600 transition-colors"
                >
                  {recipe.name}
                </Link>
              </td>
              <td className="px-4 py-3">
                <Badge variant="primary">
                  {CATEGORY_LABELS[recipe.category as MenuCategory] ?? recipe.category}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-xs font-semibold">
                  v{recipe.version ?? "—"}
                </span>
              </td>
              <td className="px-4 py-3 text-stone-500">
                {recipe.portionsYield ?? "—"} porciones
              </td>
              <td className="px-4 py-3 text-right font-semibold text-sheina-600">
                ${recipe.costPerPortion.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3">
                <Badge variant={recipe.isActive ? "success" : "default"}>
                  {recipe.isActive ? "Activa" : "Inactiva"}
                </Badge>
              </td>
            </motion.tr>
          ))}
        </motion.tbody>
      </table>
    </div>
  );
}
