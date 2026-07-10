"use client";

import { formatDayLabel, formatSlotTime, parseTstzRange } from "@/lib/time";
import type { BookingResult, Resource } from "@/types/db";

interface BookingConfirmationProps {
  resource: Resource;
  booking: BookingResult;
  onBookAnother: () => void;
}

export default function BookingConfirmation({
  resource,
  booking,
  onBookAnother,
}: BookingConfirmationProps) {
  const [startsAt, endsAt] = parseTstzRange(booking.slot);

  return (
    <section className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-5 text-sm">
      <p className="font-medium text-emerald-800 dark:text-emerald-400 mb-3">
        Booking confirmed
      </p>
      <dl className="space-y-1 text-neutral-700 dark:text-neutral-300">
        <Row label="Room" value={resource.name} />
        <Row
          label="When"
          value={`${formatDayLabel(new Date(startsAt), resource.timezone)} · ${formatSlotTime(
            startsAt,
            resource.timezone
          )}–${formatSlotTime(endsAt, resource.timezone)}`}
        />
        <Row label="Name" value={booking.customer_name ?? ""} />
        <Row label="People" value={String(booking.party_size)} />
      </dl>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-3">
        {/* No email is sent yet (that's optional, still unbuilt) — don't
            claim one went out. Booked under {booking.customer_email}. */}
        Booked under {booking.customer_email}. Keep this reference to cancel later:{" "}
        <code className="font-mono">{booking.cancel_token}</code>
      </p>
      <button
        type="button"
        onClick={onBookAnother}
        className="mt-4 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium"
      >
        Book another slot
      </button>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-neutral-500 dark:text-neutral-400 w-16 shrink-0">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
