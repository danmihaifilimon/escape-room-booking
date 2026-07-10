"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }

    // A full navigation (not router.push) so middleware and the server
    // layout re-run against the now-authenticated cookie, instead of
    // client-side routing to a server-guarded page with stale auth state.
    window.location.href = "/admin";
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 space-y-4"
      >
        <h1 className="text-lg font-semibold">Admin sign in</h1>

        <label className="block">
          <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
          />
        </label>

        <label className="block">
          <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
          />
        </label>

        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
