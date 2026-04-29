export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServer } from "@/lib/supabase/server";
import { INV_CATEGORY_LABELS } from "@/lib/types/inventory";
import { CreateItemButton } from "./create-item-button";
import { Package, AlertTriangle, ArrowUpDown, Search, MapPin, Truck } from "lucide-react";
import type { InventoryItem, InvCategory } from "@/lib/types/database";

const CATEGORY_OPTIONS: { key: string; label: string }[] = [
  { key: "all", label: "Todos" },
  ...(Object.entries(INV_CATEGORY_LABELS) as [InvCategory, string][]).map(
    ([key, label]) => ({ key, label })
  ),
];

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string; stock?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServer();

  let query = supabase
    .from("inventory_items")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (params.search?.trim()) {
    query = query.ilike("name", `%${params.search.trim()}%`);
  }
  if (params.category && params.category !== "all") {
    query = query.eq("category", params.category as InvCategory);
  }

  const { data: itemsData } = await query;
  const allItems = (itemsData ?? []) as InventoryItem[];

  const lowStockItems = allItems.filter((i) => i.current_stock < i.min_stock);
  const displayItems =
    params.stock === "low" ? lowStockItems : allItems;

  // Estadísticas globales (sin filtro)
  const { data: statsData } = await supabase
    .from("inventory_items")
    .select("id, current_stock, min_stock")
    .eq("is_active", true);
  const totalItems = statsData?.length ?? 0;
  const lowCount = (statsData ?? []).filter((i) => i.current_stock < i.min_stock).length;

  const today = new Date().toISOString().split("T")[0];
  const { count: movementsToday } = await supabase
    .from("inventory_movements")
    .select("id", { count: "exact", head: true })
    .gte("created_at", today);

  const activeCategory = params.category ?? "all";

  return (
    <div>
      <PageHeader
        title="Inventario"
        action={<CreateItemButton />}
      />

      {/* Tarjetas resumen */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3 p-4">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-text-secondary">Insumos activos</p>
              <p className="text-xl font-bold">{totalItems}</p>
            </div>
          </div>
        </Card>
        <Link href={params.stock === "low" ? "/inventario" : "/inventario?stock=low"}>
          <Card className="transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3 p-4">
              <AlertTriangle className={`h-5 w-5 ${lowCount > 0 ? "text-warning" : "text-text-secondary"}`} />
              <div>
                <p className="text-xs text-text-secondary">Stock bajo</p>
                <p className={`text-xl font-bold ${lowCount > 0 ? "text-warning" : ""}`}>{lowCount}</p>
              </div>
            </div>
          </Card>
        </Link>
        <Card>
          <div className="flex items-center gap-3 p-4">
            <ArrowUpDown className="h-5 w-5 text-info" />
            <div>
              <p className="text-xs text-text-secondary">Movimientos hoy</p>
              <p className="text-xl font-bold">{movementsToday ?? 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtro por categoría */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
        {CATEGORY_OPTIONS.map((opt) => {
          const href =
            opt.key === "all"
              ? "/inventario" +
                (params.search ? `?search=${params.search}` : "") +
                (params.stock ? `${params.search ? "&" : "?"}stock=${params.stock}` : "")
              : `/inventario?category=${opt.key}` +
                (params.search ? `&search=${params.search}` : "") +
                (params.stock ? `&stock=${params.stock}` : "");
          return (
            <Link
              key={opt.key}
              href={href}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
                activeCategory === opt.key
                  ? "border-b-2 border-primary text-primary"
                  : "text-text-secondary hover:text-text"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>

      {/* Búsqueda */}
      <form method="GET" action="/inventario" className="mb-4">
        {params.category && params.category !== "all" && (
          <input type="hidden" name="category" value={params.category} />
        )}
        {params.stock && (
          <input type="hidden" name="stock" value={params.stock} />
        )}
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <input
            name="search"
            type="search"
            defaultValue={params.search ?? ""}
            placeholder="Buscar insumo..."
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </form>

      {/* Tabla de insumos */}
      {displayItems.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Categoría</th>
                  <th className="px-4 py-3 font-medium text-right">Stock</th>
                  <th className="px-4 py-3 font-medium">Unidad</th>
                  <th className="px-4 py-3 font-medium text-right">Costo/ud</th>
                  <th className="px-4 py-3 font-medium">Proveedor</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item) => {
                  const isLow = item.current_stock < item.min_stock;
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-border last:border-0 hover:bg-surface-hover ${isLow ? "bg-red-50/50" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <Link href={`/inventario/${item.id}`} className="font-medium hover:text-primary">
                          {item.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="primary">
                          {INV_CATEGORY_LABELS[item.category] ?? item.category}
                        </Badge>
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${isLow ? "text-error" : ""}`}>
                        {item.current_stock}
                        {isLow && <span className="ml-1 text-xs">(min: {item.min_stock})</span>}
                      </td>
                      <td className="px-4 py-3">{item.unit}</td>
                      <td className="px-4 py-3 text-right">
                        ${item.cost_per_unit.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{item.supplier ?? "—"}</td>
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
            {params.search || params.category || params.stock
              ? "No hay insumos que coincidan con el filtro."
              : "No hay insumos cargados"}
          </p>
        </Card>
      )}

      {/* Catálogo maestro — Sitios y Proveedores */}
      <div className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-text">Catálogo maestro</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link href="/inventario/sites">
            <Card className="cursor-pointer p-4 transition-shadow hover:shadow-md">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Sitios</p>
                  <p className="text-xs text-text-secondary">Cocinas y depósitos de la organización.</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link href="/inventario/proveedores">
            <Card className="cursor-pointer p-4 transition-shadow hover:shadow-md">
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Proveedores</p>
                  <p className="text-xs text-text-secondary">Catálogo de proveedores de insumos.</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
