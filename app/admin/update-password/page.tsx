"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "invalid" | "success";

// The recovery link redirects here with the session in the URL hash
// (#access_token=...&type=recovery), which the server never sees — the
// browser strips fragments before sending the request. So this route can't
// be gated by the proxy the way /admin/(protected) is; auth happens
// entirely client-side, via supabase-js parsing the hash on load and
// firing a PASSWORD_RECOVERY event.
export default function UpdatePasswordPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [invalidReason, setInvalidReason] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const hashError = hash.get("error_description");
    if (hashError) {
      setInvalidReason(hashError.replace(/\+/g, " "));
      setStatus("invalid");
      return;
    }

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStatus("ready");
    });

    // If the hash didn't carry a recovery token at all (e.g. someone just
    // navigated here directly), the event above never fires.
    const timeout = setTimeout(() => {
      setStatus((s) => (s === "checking" ? "invalid" : s));
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setStatus("success");
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 space-y-4">
        <h1 className="text-lg font-semibold">Set a new password</h1>

        {status === "checking" && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Checking your reset link…</p>
        )}

        {status === "invalid" && (
          <>
            <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
              {invalidReason ?? "This reset link is missing or no longer valid."} Reset links are
              single-use and expire quickly.
            </div>
            <Link
              href="/admin/forgot-password"
              className="block text-center text-sm rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 font-medium"
            >
              Request a new link
            </Link>
          </>
        )}

        {status === "ready" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                New password
              </span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
              />
            </label>

            <label className="block">
              <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                Confirm password
              </span>
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
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
              {loading ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}

        {status === "success" && (
          <>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Password updated. You can now sign in.
            </p>
            <Link
              href="/admin/login"
              className="block text-center text-sm rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 font-medium"
            >
              Go to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
