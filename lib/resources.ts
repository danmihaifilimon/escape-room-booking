import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Resource } from "@/types/db";

async function fetchResource(slug: string): Promise<Resource> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("resources")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// Resource config (hours, capacity, timezone) changes rarely — a long
// staleTime avoids refetching it on every render.
export function useResourceQuery(slug: string) {
  return useQuery({
    queryKey: ["resource", slug],
    queryFn: () => fetchResource(slug),
    staleTime: 5 * 60 * 1000,
  });
}
