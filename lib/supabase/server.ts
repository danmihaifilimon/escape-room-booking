// Server Components / Route Handlers client — still the anon key (RLS
// decides what it can see), but reads the user's auth cookie so admin
// requests are recognised as the signed-in user, not as anon.
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component that can't set cookies (no
            // response to attach them to) — middleware refreshes the
            // session on the next request instead, so this is safe to skip.
          }
        },
      },
    }
  );
}
