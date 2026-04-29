"use client";
import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";

function fmt(d: Date) {
  const date = new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(d);
  const time = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(d);
  return `${date} · ${time}`;
}

export function LiveClock() {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur px-3 py-1.5 text-xs font-medium text-stone-600 border border-stone-200 shadow-soft">
      <Calendar className="h-3.5 w-3.5 text-sheina-600" />
      <span suppressHydrationWarning>{fmt(now)}</span>
    </span>
  );
}
