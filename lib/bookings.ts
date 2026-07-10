import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { PG_ERROR } from "@/types/db";
import type { AvailableSlot, BookingResult } from "@/types/db";

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function availabilityKey(slug: string, from: Date, days: number) {
  return ["availability", slug, from.toDateString(), days] as const;
}

// STEP 3: calls the real available_slots() RPC — see
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
  return useQuery({
    queryKey: availabilityKey(slug, from, days),
    queryFn: () => fetchAvailableSlots(slug, from, days),
  });
}

// Carries the Postgres SQLSTATE (see PG_ERROR in types/db.ts) so the caller
// can show a specific message instead of a generic "something went wrong" —
// losing the race for a slot is an expected, recoverable outcome, not really
// an error.
export class BookingError extends Error {
  constructor(readonly code: string | undefined, message: string) {
    super(message);
    this.name = "BookingError";
  }
}

export interface CreateBookingInput {
  slug: string;
  slot: AvailableSlot;
  name: string;
  email: string;
  partySize: number;
  notes?: string;
}

async function createBookingRequest(input: CreateBookingInput): Promise<BookingResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_booking", {
    p_slug: input.slug,
    p_start: input.slot.starts_at,
    p_name: input.name,
    p_email: input.email,
    p_party_size: input.partySize,
    p_notes: input.notes ?? null,
  });

  if (error) throw new BookingError(error.code, error.message);
  return data;
}

// The optimistic update + rollback pair this project exists to demonstrate.
//
// onMutate marks the slot busy in the cache immediately, before the network
// round-trip — the UI reacts the instant the user clicks, not 200ms later.
// If the server rejects the booking (most commonly: someone else took the
// same slot first, SQLSTATE 23P01 from the exclusion constraint), onError
// rolls the cache back to its pre-mutate snapshot. Either way, onSettled
// refetches from the server, which is the actual source of truth — the
// optimistic value is a guess for perceived latency, never trusted past
// that point.
export function useCreateBookingMutation(slug: string, from: Date, days: number) {
  const queryClient = useQueryClient();
  const queryKey = availabilityKey(slug, from, days);

  return useMutation({
    mutationFn: createBookingRequest,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<AvailableSlot[]>(queryKey);

      queryClient.setQueryData<AvailableSlot[]>(queryKey, (old) =>
        old?.map((s) =>
          s.starts_at === input.slot.starts_at ? { ...s, is_free: false } : s
        )
      );

      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// Maps a BookingError to copy a customer can act on. The exclusion-constraint
// case (23P01) is the one worth being specific about: it means the database
// itself serialised two concurrent attempts and this one lost, which is
// expected behaviour under load, not a malfunction.
export function describeBookingError(err: unknown): string {
  if (err instanceof BookingError) {
    switch (err.code) {
      case PG_ERROR.EXCLUSION_VIOLATION:
        return "That slot was just booked by someone else. Pick another time.";
      case PG_ERROR.SLOT_NOT_BOOKABLE:
        return "That slot is no longer bookable — it may be in the past, too soon, or outside opening hours.";
      case PG_ERROR.INVALID_INPUT:
        return "Please check the number of people.";
      case PG_ERROR.UNKNOWN_RESOURCE:
        return "This resource isn't available right now.";
      default:
        return err.message || "Something went wrong. Please try again.";
    }
  }
  return "Something went wrong. Please try again.";
}
