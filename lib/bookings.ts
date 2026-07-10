import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { AvailableSlot } from "@/types/db";

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// STEP 3 (current): calls the real available_slots() RPC — see
// supabase/migrations/0001_init.sql. anon can execute it (granted there) but
// has no direct table access, so this is the only way the browser learns
// what's free.
async function fetchAvailableSlots(
  slug: string,
  from: Date,
  days: number
): Promise<AvailableSlot[]> {
  const supabase = createClient();
  const to = new Date(from);
  to.setDate(to.getDate() + days - 1); // p_from/p_to are both inclusive in the RPC

  const { data, error } = await supabase.rpc("available_slots", {
    p_slug: slug,
    p_from: toISODate(from),
    p_to: toISODate(to),
  });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export function useAvailabilityQuery(slug: string, from: Date, days: number) {
  const fromKey = from.toDateString(); // stable across re-renders unlike the Date object identity

  return useQuery({
    queryKey: ["availability", slug, fromKey, days],
    queryFn: () => fetchAvailableSlots(slug, from, days),
  });
}
