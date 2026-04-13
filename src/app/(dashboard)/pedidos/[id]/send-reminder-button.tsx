"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { sendReminderToClient } from "@/app/actions/orders";
import { MessageSquare } from "lucide-react";

interface SendReminderButtonProps {
  orderId: string;
}

export function SendReminderButton({ orderId }: SendReminderButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleSend() {
    setLoading(true);
    const result = await sendReminderToClient(orderId);
    setLoading(false);
    if (result.ok) {
      toast("Recordatorio enviado por WhatsApp", "success");
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <Button variant="secondary" size="sm" loading={loading} onClick={handleSend}>
      <MessageSquare className="mr-1.5 h-4 w-4" />
      Enviar recordatorio
    </Button>
  );
}
