import { z } from "zod";
import { STRINGS, type Lang } from "@/lib/i18n";

// This is a UX convenience, not the security boundary — create_booking() in
// supabase/migrations/0001_init.sql re-validates everything authoritatively
// (name present, party_size <= capacity, slot actually bookable). A client
// could skip this schema entirely and the database would still refuse a bad
// booking. This just gives feedback before round-tripping to the server.
export function bookingFormSchema(capacity: number, lang: Lang = "en") {
  const e = STRINGS[lang].formErrors;
  return z.object({
    name: z.string().trim().min(1, e.nameRequired).max(200),
    email: z.string().trim().toLowerCase().email(e.emailInvalid),
    partySize: z.coerce
      .number()
      .int(e.wholeNumbersOnly)
      .min(1, e.atLeastOne)
      .max(capacity, e.maxCapacity(capacity)),
    notes: z.string().trim().max(500, e.notesTooLong).optional(),
  });
}

export type BookingFormValues = {
  name: string;
  email: string;
  partySize: string; // kept as string in form state; z.coerce.number() converts on validate
  notes: string;
};
