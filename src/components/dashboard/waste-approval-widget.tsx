"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveWaste, rejectWaste } from "@/lib/production/actions/approve-waste";
import { useToast } from "@/components/ui/toast";

interface WasteItem {
  id: string;
  item_name: string;
  item_unit: string;
  quantity: number;
  reason: string | null;
  ticket_id: string | null;
}

interface Props {
  items: WasteItem[];
}

function WasteRow({ item }: { item: WasteItem }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveWaste(item.id);
      if (result.ok) {
        toast("Merma aprobada y descontada del stock", "success");
        router.refresh();
      } else {
        toast(result.error || "Error", "error");
      }
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const result = await rejectWaste(item.id);
      if (result.ok) {
        toast("Merma rechazada", "success");
        router.refresh();
      } else {
        toast(result.error || "Error", "error");
      }
    });
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800 truncate">
          {item.item_name}: {item.quantity} {item.item_unit}
        </p>
        {item.reason && (
          <p className="text-xs text-stone-400 truncate">{item.reason}</p>
        )}
      </div>
      <div className="flex gap-1.5 flex-shrink-0">
        <button
          onClick={handleApprove}
          disabled={isPending}
          className="text-xs px-2.5 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 transition-colors font-medium"
        >
          Aprobar
        </button>
        <button
          onClick={handleReject}
          disabled={isPending}
          className="text-xs px-2.5 py-1 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 disabled:opacity-50 transition-colors font-medium"
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}

export function WasteApprovalWidget({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="divide-y divide-stone-100">
      {items.map((item) => (
        <WasteRow key={item.id} item={item} />
      ))}
    </div>
  );
}
