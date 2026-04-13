"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addAuthorizedPhoneAction } from "./actions";
import { Plus } from "lucide-react";

export function AddAuthorizedPhone({ orgId }: { orgId: string }) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addAuthorizedPhoneAction(orgId, phone.trim());
      if (result?.error) {
        setError(result.error);
      } else {
        setPhone("");
      }
    });
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex gap-2 p-4">
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+549XXXXXXXXXX"
          className="font-mono"
          pattern="\+\d{10,15}"
          title="Formato E.164: +549XXXXXXXXXX"
        />
        <Button type="submit" disabled={isPending || !phone.trim()}>
          <Plus className="h-4 w-4" />
          Agregar
        </Button>
      </form>
      {error && <p className="px-4 pb-3 text-sm text-red-600">{error}</p>}
    </Card>
  );
}
