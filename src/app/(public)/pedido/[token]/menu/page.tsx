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

function ItemDetailModal({
  item,
  qty,
  onClose,
  onQtyChange,
}: {
  item: MenuItem;
  qty: number;
  onClose: () => void;
  onQtyChange: (v: number) => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const allergens = Array.isArray(item.allergens)
    ? (item.allergens as string[]).filter(Boolean)
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {item.photo_url && (
          <div className="relative w-full h-48 bg-gray-100">
            <img
              src={item.photo_url}
              alt={item.display_name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 leading-tight">
                {item.display_name}
              </h2>
              <p className="text-xs text-gray-400 capitalize mt-0.5">{item.category}</p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          {item.description && (
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">{item.description}</p>
          )}

          <div className="flex flex-wrap gap-3 mb-4 text-xs text-gray-500">
            {item.calories_kcal != null && (
              <span className="flex items-center gap-1">
                🔥 <span>{item.calories_kcal} kcal</span>
              </span>
            )}
            {item.weight_grams != null && (
              <span className="flex items-center gap-1">
                ⚖️ <span>{item.weight_grams} g</span>
              </span>
            )}
            {item.unit_price != null && (
              <span className="flex items-center gap-1">
                💲 <span>${item.unit_price.toFixed(2)}</span>
              </span>
            )}
          </div>

          {allergens.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Alérgenos</p>
              <div className="flex flex-wrap gap-1">
                {allergens.map((a) => (
                  <span
                    key={a}
                    className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t">
            <span className="text-sm font-medium text-gray-700">Cantidad</span>
            <NumberInput value={qty} onChange={onQtyChange} min={0} max={20} />
          </div>
        </div>
      </div>
    </div>
  );
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
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);

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
                  ? "bg-sheina-600 text-white shadow-soft"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
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
                  className="bg-white border border-stone-200 rounded-xl p-4 flex items-center gap-4 shadow-soft hover:shadow-lift transition-all duration-200"
                >
                  {item.photo_url && (
                    <img
                      src={item.photo_url}
                      alt={item.display_name}
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0 cursor-pointer"
                      onClick={() => setDetailItem(item)}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-1">
                      <p className="font-medium text-gray-900 text-sm leading-tight">
                        {item.display_name}
                      </p>
                      <button
                        onClick={() => setDetailItem(item)}
                        className="shrink-0 mt-0.5 text-stone-300 hover:text-sheina-600 transition-colors"
                        aria-label="Ver detalle"
                        title="Ver detalle"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="w-4 h-4"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5 capitalize">{item.category}</p>
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
            className="bg-sheina-600 hover:bg-sheina-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-soft transition-all active:scale-[0.98]"
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

      {/* Item detail modal */}
      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          qty={cart[cartKey(detailItem.id, detailItem.day_of_week)] ?? 0}
          onClose={() => setDetailItem(null)}
          onQtyChange={(v) => {
            handleQuantityChange(detailItem, v);
          }}
        />
      )}
    </div>
  );
}
