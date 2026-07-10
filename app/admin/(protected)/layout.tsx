import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/admin/SignOutButton";

// middleware.ts already redirects unauthenticated requests to /admin/login
// (it can't check is_admin cheaply there — that's a DB round trip this
// layout has to make anyway). This layout adds the actual authorization
// check: signed in, but not an admin, gets a plain "not authorized" message
// rather than being redirected back into a login loop.
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return (
      <div className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10">
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-5 text-sm text-amber-800 dark:text-amber-400">
          Signed in as {user.email}, but this account isn&apos;t an admin.
        </div>
        <SignOutButton className="mt-4" />
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold tracking-tight">Bookings</h1>
        <div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
          <span>{user.email}</span>
          <SignOutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
