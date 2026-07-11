"use client";

import { createClient } from "@/lib/supabase/client";
import { BASE_PATH } from "@/lib/basePath";

export default function SignOutButton({ className = "" }: { className?: string }) {
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Full navigation, not router.push — clears client-side query cache and
    // re-runs middleware against the now-signed-out cookie state. basePath
    // isn't applied to raw window.location.href, so it's prefixed by hand.
    window.location.href = `${BASE_PATH}/admin/login`;
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
