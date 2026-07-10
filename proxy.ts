import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Next.js 16 renamed the middleware file convention to "proxy" — this file
// must be named proxy.ts (not middleware.ts) and export a function named
// `proxy` (verified against next/dist/build/templates/middleware.js, which
// looks up `mod.proxy` specifically when the file is at this path).
//
// Refreshes the auth session on every request (the access token in the
// cookie is very likely expired by the time it reaches the server — see
// @supabase/ssr's own design docs — so getUser() below is what actually
// exchanges the refresh token and re-issues cookies, not just a formality).
//
// Only gates presence of a session; whether that user is actually an admin
// is checked in app/admin/(protected)/layout.tsx, which has to run a DB
// query anyway (profiles.is_admin) — no point duplicating that here.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname === "/admin/login";
  if (request.nextUrl.pathname.startsWith("/admin") && !isLoginPage && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
