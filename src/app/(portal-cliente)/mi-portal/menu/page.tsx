import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServer } from "@/lib/supabase/server";

const DAY_NAMES: Record<number, string> = {
  1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes",
};

export default async function MenuActivoPage() {
  const currentUser = await requireUser();
  if (!currentUser.organizationId) return null;

  const supabase = await createSupabaseServer();

  const { data: order } = await supabase
    .from("orders")
    .select("id, week_label, menu_id")
    .eq("organization_id", currentUser.organizationId)
    .in("status", ["draft", "confirmed", "in_production", "awaiting_confirmation", "partially_filled"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!order?.menu_id) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-heading font-light text-stone-900 mb-2">Sin pedido activo</h1>
        <p className="text-sm text-stone-500">
          Cuando Sheina cree un pedido para tu empresa, el menú aparecerá acá.
        </p>
      </div>
    );
  }

  const { data: items } = await supabase
    .from("menu_items")
    .select("id, day_of_week, option_code, display_name, photo_url, category")
    .eq("menu_id", order.menu_id)
    .eq("is_available", true)
    .order("day_of_week")
    .order("option_code");

  const grouped: Record<number, typeof items> = {};
  for (const item of items ?? []) {
    if (!grouped[item.day_of_week]) grouped[item.day_of_week] = [];
    grouped[item.day_of_week]!.push(item);
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Menú activo</p>
      <h1 className="text-2xl font-heading font-light text-stone-900 mb-8">{order.week_label}</h1>

      {[1, 2, 3, 4, 5].map((day) => {
        const dayItems = grouped[day];
        if (!dayItems?.length) return null;
        return (
          <section key={day} className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-500 mb-3">
              {DAY_NAMES[day]}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dayItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl overflow-hidden border border-stone-200"
                >
                  {item.photo_url ? (
                    <img
                      src={item.photo_url}
                      alt={item.display_name}
                      className="w-full h-36 object-cover"
                    />
                  ) : (
                    <div className="w-full h-36 bg-gradient-to-br from-amber-50 to-stone-100 flex items-center justify-center">
                      <span className="font-heading italic text-4xl text-stone-300">
                        {item.option_code}
                      </span>
                    </div>
                  )}
                  <div className="p-3">
                    <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-0.5">
                      Opción {item.option_code}
                    </p>
                    <p className="text-sm font-medium text-stone-900">{item.display_name}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
