import { createClient } from "@/lib/supabase/server";
import BookingsTable from "@/components/admin/BookingsTable";
import type { TimeBlock } from "@/types/db";

const RESOURCE_SLUG = "escape-cluj"; // matches the constant in app/page.tsx — single-resource site for now

export default async function AdminBookingsPage() {
  const supabase = await createClient();

  const [{ data: bookings, error: bookingsError }, { data: resource }] = await Promise.all([
    supabase
      .from("time_blocks")
      .select("*")
      .eq("kind", "booking")
      .order("created_at", { ascending: false }),
    supabase.from("resources").select("timezone").eq("slug", RESOURCE_SLUG).single(),
  ]);

  if (bookingsError) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-5 text-sm text-red-700 dark:text-red-400">
        Couldn&apos;t load bookings: {bookingsError.message}
      </div>
    );
  }

  return (
    <BookingsTable
      bookings={(bookings ?? []) as TimeBlock[]}
      timeZone={resource?.timezone ?? "Europe/Bucharest"}
    />
  );
}
