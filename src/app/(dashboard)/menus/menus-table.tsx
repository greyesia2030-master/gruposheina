"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { DuplicateMenuButton } from "./duplicate-menu-button";
import { MENU_STATUS_LABELS } from "@/lib/types/menus";
import { fadeInUp, staggerContainer } from "@/lib/design/motion";
import type { MenuStatus } from "@/lib/types/database";

const STATUS_VARIANT: Record<MenuStatus, "default" | "success" | "warning"> = {
  draft:     "default",
  published: "success",
  archived:  "warning",
};

export type MenuTableRow = {
  id: string;
  weekLabel: string;
  weekNumber: number;
  status: string;
  itemCount: number;
};

export function MenusTable({ rows }: { rows: MenuTableRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-stone-50 border-b border-stone-200 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
            <th className="px-4 py-3">Semana</th>
            <th className="px-4 py-3">N.° sem.</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3 text-right">Opciones</th>
            <th className="px-4 py-3">Acciones</th>
          </tr>
        </thead>
        <motion.tbody variants={staggerContainer} initial="hidden" animate="visible">
          {rows.map((menu) => (
            <motion.tr
              key={menu.id}
              variants={fadeInUp}
              className="border-b border-stone-100 last:border-0 hover:bg-sheina-50/40 transition-colors"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/menus/${menu.id}`}
                  className="font-medium hover:text-sheina-600 transition-colors"
                >
                  {menu.weekLabel}
                </Link>
              </td>
              <td className="px-4 py-3 text-stone-500">
                Sem. {menu.weekNumber}
              </td>
              <td className="px-4 py-3">
                <Badge variant={STATUS_VARIANT[menu.status as MenuStatus] ?? "default"}>
                  {MENU_STATUS_LABELS[menu.status] ?? menu.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <span className={menu.itemCount === 35 ? "text-success font-semibold" : ""}>
                  {menu.itemCount}
                  <span className="ml-1 text-xs text-stone-400">/35</span>
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/menus/${menu.id}`}
                    className="text-sm text-sheina-600 hover:underline"
                  >
                    Editar
                  </Link>
                  <DuplicateMenuButton
                    sourceMenuId={menu.id}
                    sourceWeekLabel={menu.weekLabel}
                  />
                </div>
              </td>
            </motion.tr>
          ))}
        </motion.tbody>
      </table>
    </div>
  );
}
