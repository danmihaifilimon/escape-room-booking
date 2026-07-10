// Browser client — uses the anon/publishable key, which is meant to be
// public. RLS (see supabase/migrations/0001_init.sql) is what actually
// protects the data, not secrecy of this key.
"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
