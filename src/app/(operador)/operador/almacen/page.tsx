import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { MapPin, Truck } from "lucide-react";

const ALLOWED_ROLES = ["warehouse", "admin", "superadmin"];

export default async function AlmacenPage() {
  const user = await requireUser();

  if (!ALLOWED_ROLES.includes(user.role)) {
    redirect("/operador");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-heading font-light text-stone-900 mb-1">Inventario</h1>
      <p className="text-sm text-stone-400 mb-8">
        Gestión de sitios, proveedores, recepciones y lotes.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/operador/almacen/sites">
          <Card className="p-5 flex flex-col gap-3 hover:border-[#D4622B]/40 transition-colors cursor-pointer">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100">
              <MapPin className="h-5 w-5 text-stone-500" />
            </div>
            <div>
              <p className="font-medium text-stone-900 text-sm">Sitios</p>
              <p className="text-xs text-stone-400 mt-1">
                Cocinas y depósitos de la organización.
              </p>
            </div>
          </Card>
        </Link>

        <Link href="/operador/almacen/proveedores">
          <Card className="p-5 flex flex-col gap-3 hover:border-[#D4622B]/40 transition-colors cursor-pointer">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100">
              <Truck className="h-5 w-5 text-stone-500" />
            </div>
            <div>
              <p className="font-medium text-stone-900 text-sm">Proveedores</p>
              <p className="text-xs text-stone-400 mt-1">
                Catálogo de proveedores de insumos.
              </p>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
