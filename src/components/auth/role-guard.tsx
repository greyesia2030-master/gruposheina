"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

type AllowedRole =
  | "superadmin"
  | "admin"
  | "client_admin"
  | "client_user"
  | "kitchen"
  | "warehouse"
  | "operator";

interface Props {
  allowed: AllowedRole[];
  loginPath?: string;
}

export function RoleGuard({ allowed, loginPath = "/login" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const checkingRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      if (checkingRef.current) return;
      checkingRef.current = true;

      try {
        const supa = createBrowserClient();
        const {
          data: { user },
        } = await supa.auth.getUser();

        if (!user) {
          if (mounted) router.replace(loginPath);
          return;
        }

        const { data: dbUser } = await supa
          .from("users")
          .select("role")
          .eq("auth_id", user.id)
          .maybeSingle();

        const role = (dbUser?.role as string) ?? "";

        if (!allowed.includes(role as AllowedRole)) {
          await supa.auth.signOut();
          if (mounted) {
            router.replace(loginPath);
            // Hard reload para limpiar bfcache completamente
            setTimeout(() => window.location.replace(loginPath), 100);
          }
        }
      } catch {
        try {
          const supa = createBrowserClient();
          await supa.auth.signOut();
        } catch {
          /* ignore */
        }
        if (mounted) router.replace(loginPath);
      } finally {
        checkingRef.current = false;
      }
    }

    check();

    // visibilitychange + pageshow cubren el caso bfcache:
    // al presionar back-button el browser dispara pageshow con persisted=true
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    const onPageShow = () => check();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onVisible);

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onVisible);
    };
  }, [pathname, router, loginPath, allowed]);

  return null;
}
