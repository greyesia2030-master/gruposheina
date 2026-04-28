"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  async function handleSignOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    window.location.replace("/login");
  }
  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="flex items-center gap-2 px-3 py-2 text-sm text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors w-full"
    >
      <LogOut className="h-4 w-4" />
      Salir
    </button>
  );
}
