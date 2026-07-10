"use client";

import { createClient } from "@/lib/supabase/client";

export default function SignOutButton({ className = "" }: { className?: string }) {
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Full navigation, not router.push — clears client-side query cache and
    // re-runs middleware against the now-signed-out cookie state.
    window.location.href = "/admin/login";
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className={`rounded-full border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 font-medium hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors ${className}`}
    >
      Sign out
    </button>
  );
}
