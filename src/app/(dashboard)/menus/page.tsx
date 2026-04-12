export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServer } from "@/lib/supabase/server";
import { MENU_STATUS_LABELS } from "@/lib/types/menus";
import { CreateMenuButton } from "./create-menu-button";
import { DuplicateMenuButton } from "./duplicate-menu-button";
import type { MenuStatus } from "@/lib/types/database";
import { formatART } from "@/lib/utils/timezone";

const STATUS_VARIANT: Record<MenuStatus, "default" | "success" | "warning"> = {
  draft:     "default",
  published: "success",
  archived:  "warning",
};

function formatWeekRange(weekStart: string, weekEnd: string) {
  return (
    formatART(weekStart + "T12:00:00Z", "dd MMM") +
    " — " +
    formatART(weekEnd + "T12:00:00Z", "dd MMM")
  );
}

export default async function MenusPage() {
  const supabase = await createSupabaseServer();

  const { data: menus } = await supabase
    .from("weekly_menus")
    .select("*, items:menu_items(id)")
    .order("week_start", { ascending: false });

  return (
    <div>
      <PageHeader title="Menús semanales" action={<CreateMenuButton />} />

      {menus && menus.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="px-4 py-3 font-medium">Semana</th>
                  <th className="px-4 py-3 font-medium">N.° sem.</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Opciones</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {menus.map((menu) => {
                  const weekLabel = formatWeekRange(menu.week_start, menu.week_end);
                  const itemCount = (menu.items as { id: string }[])?.length ?? 0;
                  return (
                    <tr
                      key={menu.id}
                      className="border-b border-border last:border-0 hover:bg-surface-hover"
                    >
                      <td className="px-4 py-3">
                        <Link href={`/menus/${menu.id}`} className="font-medium hover:text-primary">
                          {weekLabel}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        Sem. {menu.week_number}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[menu.status as MenuStatus] ?? "default"}>
                          {MENU_STATUS_LABELS[menu.status] ?? menu.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={itemCount === 35 ? "text-success font-semibold" : ""}>
                          {itemCount}
                          <span className="ml-1 text-xs text-text-secondary">/35</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/menus/${menu.id}`}
                            className="text-sm text-primary hover:underline"
                          >
                            Editar
                          </Link>
                          <DuplicateMenuButton
                            sourceMenuId={menu.id}
                            sourceWeekLabel={weekLabel}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="p-8 text-center text-text-secondary">
            No hay menús creados todavía.{" "}
            <span className="text-primary">Creá el primero con el botón de arriba.</span>
          </p>
        </Card>
      )}
    </div>
  );
}
