"use client";

import { useState, useRef, useEffect } from "react";
import { sendCommunication } from "@/app/actions/communications";
import { useToast } from "@/components/ui/toast";
import type {
  CommunicationDirection,
  CommunicationChannel,
  CommunicationCategory,
} from "@/lib/types/database";

interface Message {
  id: string;
  body: string;
  direction: CommunicationDirection;
  channel: CommunicationChannel;
  status: string;
  created_at: string;
  sent_at: string | null;
}

interface ThreadData {
  id: string;
  subject: string | null;
  status: string;
  category: CommunicationCategory;
  organization_id: string | null;
  organizations: {
    id: string;
    name: string;
    primary_contact_email: string | null;
    email: string | null;
  } | null;
}

export function ThreadClient({
  thread,
  messages: initialMessages,
}: {
  thread: ThreadData;
  messages: Message[];
}) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const recipientEmail =
    thread.organizations?.primary_contact_email ?? thread.organizations?.email ?? null;

  const handleSend = async () => {
    if (!body.trim() || !thread.organization_id) return;
    if (!recipientEmail) {
      toast("Esta organización no tiene email configurado", "error");
      return;
    }

    // Optimistic update
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      body: body.trim(),
      direction: "outbound",
      channel: "email",
      status: "sending",
      created_at: new Date().toISOString(),
      sent_at: null,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setBody("");
    setSending(true);

    const result = await sendCommunication(
      thread.organization_id,
      "email",
      thread.category,
      recipientEmail,
      tempMsg.body,
      {
        threadId: thread.id,
        subject: `Re: ${thread.subject ?? "Mensaje"}`,
      }
    );

    setSending(false);

    if (!result.ok) {
      toast(result.error, "error");
      setMessages((prev) =>
        prev.map((m) => (m.id === tempMsg.id ? { ...m, status: "failed" } : m))
      );
    } else {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempMsg.id
            ? { ...m, id: result.data.id, status: "sent", sent_at: new Date().toISOString() }
            : m
        )
      );
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
      {/* Header */}
      <div className="mb-4 pb-4 border-b flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#D4622B]/10 text-[#D4622B] flex items-center justify-center font-semibold text-sm flex-shrink-0">
          {thread.organizations?.name?.charAt(0)?.toUpperCase() ?? "?"}
        </div>
        <div>
          <h1 className="font-bold text-gray-900">{thread.organizations?.name ?? "Sin organización"}</h1>
          <p className="text-sm text-gray-500">{thread.subject ?? "Sin asunto"}</p>
        </div>
        {recipientEmail && (
          <span className="ml-auto text-xs text-gray-400 truncate max-w-48">{recipientEmail}</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">
            No hay mensajes en este hilo todavía.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                msg.direction === "outbound"
                  ? "bg-[#D4622B] text-white rounded-tr-sm"
                  : "bg-gray-100 text-gray-900 rounded-tl-sm"
              } ${msg.status === "failed" ? "opacity-60 ring-2 ring-red-400" : ""}`}
            >
              <p className="whitespace-pre-wrap">{msg.body}</p>
              <p
                className={`text-xs mt-1 ${
                  msg.direction === "outbound" ? "text-orange-200" : "text-gray-400"
                }`}
              >
                {new Date(msg.created_at).toLocaleTimeString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {msg.status === "failed" && " · Error al enviar"}
                {msg.status === "sending" && " · Enviando…"}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="mt-4 border rounded-xl overflow-hidden shadow-sm">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
          }}
          placeholder={
            recipientEmail
              ? "Escribí tu mensaje… (Ctrl+Enter para enviar)"
              : "Esta organización no tiene email configurado"
          }
          disabled={!recipientEmail}
          className="w-full px-4 py-3 resize-none outline-none text-sm disabled:bg-gray-50 disabled:text-gray-400"
          rows={3}
        />
        <div className="flex justify-end items-center px-3 py-2 bg-gray-50 border-t gap-2">
          <span className="text-xs text-gray-400">Ctrl+Enter para enviar</span>
          <button
            onClick={handleSend}
            disabled={!body.trim() || sending || !recipientEmail}
            className="px-4 py-2 bg-[#D4622B] hover:bg-[#be5526] text-white rounded-lg font-medium text-sm disabled:opacity-50 transition-colors"
          >
            {sending ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
