"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Notification {
  id: string;
  title: string;
  body: string;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  return `hace ${Math.floor(hrs / 24)} d`;
}

export function NotificationBell({ userId, organizationId }: { userId: string; organizationId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createBrowserClient();

  const load = useCallback(async () => {
    let query = supabase
      .from("user_notifications")
      .select("id, title, body, link_url, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    if (organizationId) {
      query = query.or(`recipient_user_id.eq.${userId},recipient_organization_id.eq.${organizationId}`);
    } else {
      query = query.eq("recipient_user_id", userId);
    }

    const { data } = await query;
    const notifs = (data ?? []) as Notification[];
    setNotifications(notifs);
    setUnreadCount(notifs.filter((n) => !n.read_at).length);
  }, [supabase, userId, organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function markRead(id: string) {
    await supabase
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setOpen((p) => !p); if (!open) load(); }}
        className="relative rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition-colors"
        title={`${unreadCount} notificaciones`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D4622B] px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-stone-200 bg-white shadow-lg">
          <div className="border-b border-stone-100 px-4 py-3">
            <p className="text-sm font-semibold text-stone-800">Notificaciones</p>
          </div>

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-stone-400">
              <Bell className="h-8 w-8 opacity-30" />
              <p className="text-sm">Sin notificaciones</p>
            </div>
          ) : (
            <ul className="divide-y divide-stone-100 max-h-80 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id}>
                  {n.link_url ? (
                    <Link
                      href={n.link_url}
                      onClick={async () => { await markRead(n.id); setOpen(false); router.push(n.link_url!); }}
                      className={`flex items-start gap-3 px-4 py-3 hover:bg-stone-50 transition-colors ${!n.read_at ? "bg-amber-50/60" : ""}`}
                    >
                      <NotifContent n={n} />
                    </Link>
                  ) : (
                    <div
                      onClick={() => markRead(n.id)}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-stone-50 transition-colors ${!n.read_at ? "bg-amber-50/60" : ""}`}
                    >
                      <NotifContent n={n} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function NotifContent({ n }: { n: { title: string; body: string; read_at: string | null; created_at: string } }) {
  return (
    <>
      {!n.read_at && (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#D4622B]" />
      )}
      <div className={`min-w-0 flex-1 ${n.read_at ? "pl-4" : ""}`}>
        <p className="truncate text-sm font-medium text-stone-800">{n.title}</p>
        <p className="text-xs text-stone-500 line-clamp-2">{n.body}</p>
      </div>
      <span className="shrink-0 text-[10px] text-stone-400">{timeAgo(n.created_at)}</span>
    </>
  );
}
