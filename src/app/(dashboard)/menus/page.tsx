export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { createSupabaseServer } from "@/lib/supabase/server";
import { CreateMenuButton } from "./create-menu-button";
import { MenusTable, type MenuTableRow } from "./menus-table";
import { formatART } from "@/lib/utils/timezone";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

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

  const rows: MenuTableRow[] = (menus ?? []).map((menu) => ({
    id: menu.id,
    weekLabel: formatWeekRange(menu.week_start, menu.week_end),
    weekNumber: menu.week_number,
    status: menu.status,
    itemCount: (menu.items as { id: string }[])?.length ?? 0,
  }));

  return (
    <div>
      <PageHeader title="Menús semanales" action={<CreateMenuButton />} />

      {rows.length > 0 ? (
        <Card>
          <MenusTable rows={rows} />
        </Card>
      ) : (
        <EmptyState
          icon={CalendarDays}
          title="Sin menús creados"
          description="Creá el primer menú semanal con el botón de arriba."
        />
      )}
    </div>
  );
}
