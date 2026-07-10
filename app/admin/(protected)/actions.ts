"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Relies entirely on RLS's blocks_admin_all policy (see
// supabase/migrations/0001_init.sql) rather than checking is_admin() here —
// if the calling session isn't an admin, the UPDATE matches 0 rows instead
// of erroring, which this function reports as a no-op. Belt-and-suspenders
// isn't needed: the (protected) layout already keeps non-admins from
// reaching this page's UI at all, and RLS is what actually enforces it even
// if that check were ever bypassed.
export async function adminCancelBooking(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error, count } = await supabase
    .from("time_blocks")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id)
    .eq("status", "confirmed");

  if (error) return { error: error.message };
  if (!count) return { error: "Nothing was cancelled — it may already be cancelled." };

  revalidatePath("/admin");
  return {};
}
