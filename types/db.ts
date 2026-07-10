// Hand-written to match supabase/migrations/0001_init.sql exactly — there's no
// linked Supabase CLI project here to run `supabase gen types typescript`
// against. If the migration changes, update this by hand alongside it.

export type BlockKind = "booking" | "block";
export type BlockStatus = "confirmed" | "cancelled";

export interface Resource {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  slot_minutes: number;
  capacity: number;
  lead_minutes: number;
  horizon_days: number;
  is_active: boolean;
  created_at: string;
}

export interface BusinessHour {
  id: string;
  resource_id: string;
  weekday: number; // 0 = Sunday, matching JS Date#getDay()
  opens_at: string; // "HH:MM:SS"
  closes_at: string;
}

// The full row shape — only ever visible to an authenticated admin (RLS).
export interface TimeBlock {
  id: string;
  resource_id: string;
  kind: BlockKind;
  status: BlockStatus;
  slot: string; // Postgres tstzrange as text, e.g. ["2030-01-01 10:00:00+00","2030-01-01 11:00:00+00")
  customer_name: string | null;
  customer_email: string | null;
  party_size: number | null;
  notes: string | null;
  reason: string | null;
  cancel_token: string;
  created_at: string;
  cancelled_at: string | null;
}

// What available_slots() returns — the only shape anon/authenticated ever see
// for the public calendar. Deliberately has no customer fields.
export interface AvailableSlot {
  starts_at: string;
  ends_at: string;
  is_free: boolean;
}

// create_booking()'s return value: the inserted row, RETURNING *.
export type BookingResult = TimeBlock;

// Postgres error codes this schema deliberately raises, surfaced through
// PostgREST's RPC error shape ({ code, message, ... }).
export const PG_ERROR = {
  EXCLUSION_VIOLATION: "23P01", // slot already taken (race lost to the DB, not the app)
  UNKNOWN_RESOURCE: "45001",
  INVALID_INPUT: "45002", // bad name / party_size
  SLOT_NOT_BOOKABLE: "45003", // off-grid, in the past, past the horizon, outside hours
  BOOKING_NOT_FOUND: "45004", // bad/replayed cancel token
} as const;
