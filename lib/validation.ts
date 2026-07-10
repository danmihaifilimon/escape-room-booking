import { z } from "zod";

// This is a UX convenience, not the security boundary — create_booking() in
// supabase/migrations/0001_init.sql re-validates everything authoritatively
// (name present, party_size <= capacity, slot actually bookable). A client
// could skip this schema entirely and the database would still refuse a bad
// booking. This just gives feedback before round-tripping to the server.
export function bookingFormSchema(capacity: number) {
  return z.object({
    name: z.string().trim().min(1, "Name is required").max(200),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    partySize: z.coerce
      .number()
      .int("Whole numbers only")
      .min(1, "At least 1 person")
      .max(capacity, `This room fits at most ${capacity}`),
    notes: z.string().trim().max(500, "Keep it under 500 characters").optional(),
  });
}

export type BookingFormValues = {
  name: string;
  email: string;
  partySize: string; // kept as string in form state; z.coerce.number() converts on validate
  notes: string;
};
