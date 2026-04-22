"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getMenuItemsForToken, upsertCartLine } from "@/app/actions/shared-form-public";
import { NumberInput } from "@/components/ui/input";
import { PageLoading } from "@/components/ui/loading";
import { useToast } from "@/components/ui/toast";
import { CartDrawer } from "@/components/CartDrawer";
import type { MenuItem } from "@/lib/types/database";

const DAY_NAMES: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
};

type CartState = Record<string, number>; // `${menuItemId}-${dayOfWeek}`

function cartKey(menuItemId: string, dayOfWeek: number) {
  return `${menuItemId}-${dayOfWeek}`;
}

export default function MenuPage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const { toast } = useToast();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [availableDays, setAvailableDays] = useState<number[]>([]);
  const [cart, setCart] = useState<CartState>({});
  const [loading, setLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    const at = localStorage.getItem(`access_token_${token}`);
    if (!at) {
      router.replace(`/pedido/${token}`);
      return;
    }
    setAccessToken(at);

    getMenuItemsForToken(token).then((result) => {
      if (result.ok) {
        const menuItems = result.data as unknown as MenuItem[];
        setItems(menuItems);
        const days = [...new Set(menuItems.map((i) => i.day_of_week))].sort(
          (a, b) => a - b
        );
        setAvailableDays(days);
        if (days.length > 0) setSelectedDay(days[0]);
      } else {
        toast("No se pudo cargar el menú", "error");
      }
      setLoading(false);
    });
  }, [token, router, toast]);

  const itemsForDay = items.filter((i) => i.day_of_week === selectedDay);
  const totalInCart = Object.values(cart).reduce((s, q) => s + q, 0);

  const handleQuantityChange = useCallback(
    async (item: MenuItem, qty: number) => {
      const key = cartKey(item.id, item.day_of_week);
      setCart((prev) => ({ ...prev, [key]: qty }));
      if (!accessToken) return;
      const result = await upsertCartLine(accessToken, item.id, item.day_of_week, qty);
      if (!result.ok) toast("Error al guardar cantidad", "error");
    },
    [accessToken, toast]
  );

  if (loading) return <PageLoading />;

  return (
    <div className="pb-24">
      {/* Day tabs — sticky below header */}
      <div className="bg-white border-b sticky top-[57px] z-10">
        <div className="flex gap-1 px-4 py-2 overflow-x-auto">
          {availableDays.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedDay === day
                  ? "bg-[#D4622B] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {DAY_NAMES[day]}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <h2 className="text-sm font-medium text-gray-500 mb-4">
          {DAY_NAMES[selectedDay]} — {itemsForDay.length} opción
          {itemsForDay.length !== 1 ? "es" : ""}
        </h2>

        {itemsForDay.length === 0 ? (
          <p className="text-center text-gray-400 py-12">
            No hay opciones disponibles para este día.
          </p>
        ) : (
          <div className="space-y-3">
            {itemsForDay.map((item) => {
              const qty = cart[cartKey(item.id, item.day_of_week)] ?? 0;
              return (
                <div
                  key={item.id}
                  className="bg-white border rounded-xl p-4 flex items-center gap-4 shadow-sm"
                >
                  {item.photo_url && (
                    <img
                      src={item.photo_url}
                      alt={item.display_name}
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm leading-tight">
                      {item.display_name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">{item.category}</p>
                    {item.calories_kcal && (
                      <p className="text-xs text-gray-400">{item.calories_kcal} kcal</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <NumberInput
                      value={qty}
                      onChange={(v) => handleQuantityChange(item, v)}
                      min={0}
                      max={20}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky bottom bar */}
      {totalInCart > 0 && !showCart && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3 flex items-center justify-between gap-4 z-20">
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{totalInCart}</span> viandas
          </span>
          <button
            onClick={() => setShowCart(true)}
            className="bg-[#D4622B] text-white px-5 py-2 rounded-lg text-sm font-medium"
          >
            Ver carrito →
          </button>
        </div>
      )}

      {/* CartDrawer */}
      {accessToken && (
        <CartDrawer
          accessToken={accessToken}
          isOpen={showCart}
          onClose={() => setShowCart(false)}
          onSubmit={() => {
            setShowCart(false);
            router.push(`/pedido/${token}/resumen`);
          }}
        />
      )}
    </div>
  );
}
