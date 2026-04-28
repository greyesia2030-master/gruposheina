import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sin sesión → redirect a login (excepto rutas públicas)
  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/api/webhook") &&
    !request.nextUrl.pathname.startsWith("/pedido") &&
    !request.nextUrl.pathname.startsWith("/api/email/webhook")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => redirectResponse.cookies.set(cookie.name, cookie.value));
    return redirectResponse;
  }

  // Con sesión → resolver rol para redirects específicos por portal
  if (user) {
    const { data: userRecord } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .maybeSingle();

    const role = (userRecord?.role as string | undefined) ?? "";
    const pathname = request.nextUrl.pathname;

    const isClientRole = role === "client_admin" || role === "client_user";
    const isOperatorRole = ["operator", "kitchen", "warehouse"].includes(role);
    const isAdminRole = ["superadmin", "admin"].includes(role);

    function roleRedirect(to: string) {
      const url = request.nextUrl.clone();
      url.pathname = to;
      const r = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((c) => r.cookies.set(c.name, c.value));
      return r;
    }

    // ── Login page: siempre redirigir al portal correcto ─────────────────
    if (pathname.startsWith("/login")) {
      if (isClientRole) return roleRedirect("/mi-portal/pedidos");
      if (isOperatorRole) return roleRedirect("/operador");
      return roleRedirect("/pedidos");
    }

    // ── Clientes: allowlist (solo /mi-portal/*, /pedido/*, /login) ───────
    // Cualquier otra ruta → /mi-portal/pedidos (incluye /, /pedidos, /menus...)
    if (isClientRole) {
      const clientAllowed =
        pathname.startsWith("/mi-portal") ||
        pathname.startsWith("/pedido/");
      if (!clientAllowed) {
        return roleRedirect("/mi-portal/pedidos");
      }
    }

    // ── Operadores: solo /operador/* ─────────────────────────────────────
    if (isOperatorRole) {
      const operatorAllowed = pathname.startsWith("/operador");
      if (!operatorAllowed) {
        return roleRedirect("/operador");
      }
    }

    // ── No-clientes (admin/superadmin) accediendo /mi-portal: permitir ──
    // Superadmin/admin pueden entrar a /mi-portal para inspección QA.
    // Operadores NO deben acceder — ya bloqueado arriba.
    if (!isClientRole && !isAdminRole && pathname.startsWith("/mi-portal")) {
      return roleRedirect("/pedidos");
    }
  }

  return supabaseResponse;
}
