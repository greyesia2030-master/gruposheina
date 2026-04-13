"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { removeAuthorizedPhoneAction } from "./actions";
import { X } from "lucide-react";

export function RemoveAuthorizedPhone({ orgId, phone }: { orgId: string; phone: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-text-secondary hover:text-red-600"
      disabled={isPending}
      onClick={() => startTransition(() => removeAuthorizedPhoneAction(orgId, phone))}
    >
      <X className="h-4 w-4" />
    </Button>
  );
}
