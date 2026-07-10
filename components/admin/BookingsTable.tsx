"use client";

import { useMemo, useState, useTransition } from "react";
import { adminCancelBooking } from "@/app/admin/(protected)/actions";
import { formatDayLabel, formatSlotTime, parseTstzRange } from "@/lib/time";
import type { TimeBlock } from "@/types/db";

interface Row {
  booking: TimeBlock;
  startsAt: string;
  endsAt: string;
  isPast: boolean;
}

function toRows(bookings: TimeBlock[]): Row[] {
  const now = Date.now();
  return bookings
    .map((booking) => {
      const [startsAt, endsAt] = parseTstzRange(booking.slot);
      return { booking, startsAt, endsAt, isPast: new Date(endsAt).getTime() < now };
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export default function BookingsTable({
  bookings,
  timeZone,
}: {
  bookings: TimeBlock[];
  timeZone: string;
}) {
  const rows = useMemo(() => toRows(bookings), [bookings]);
  const upcoming = rows.filter((r) => !r.isPast && r.booking.status === "confirmed");
  const history = rows.filter((r) => r.isPast || r.booking.status === "cancelled");

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-3">
          Upcoming ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <EmptyState text="No upcoming bookings." />
        ) : (
          <div className="space-y-2">
            {upcoming.map((row) => (
              <BookingRow key={row.booking.id} row={row} timeZone={timeZone} cancellable />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-3">
          History ({history.length})
        </h2>
        {history.length === 0 ? (
          <EmptyState text="Nothing here yet." />
        ) : (
          <div className="space-y-2">
            {history.map((row) => (
              <BookingRow key={row.booking.id} row={row} timeZone={timeZone} cancellable={false} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-5 text-sm text-neutral-500 dark:text-neutral-400">
      {text}
    </div>
  );
}

function BookingRow({
  row,
  timeZone,
  cancellable,
}: {
  row: Row;
  timeZone: string;
  cancellable: boolean;
}) {
  const { booking, startsAt, endsAt } = row;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCancel() {
    if (!window.confirm(`Cancel ${booking.customer_name}'s booking?`)) return;

    setError(null);
    startTransition(async () => {
      const result = await adminCancelBooking(booking.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="font-medium text-sm">
          {formatDayLabel(new Date(startsAt), timeZone)} · {formatSlotTime(startsAt, timeZone)}–
          {formatSlotTime(endsAt, timeZone)}
        </p>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
          {booking.customer_name} · {booking.customer_email} · {booking.party_size}{" "}
          {booking.party_size === 1 ? "person" : "people"}
        </p>
        {booking.notes && (
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{booking.notes}</p>
        )}
        {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
      </div>

      <div className="shrink-0 flex items-center gap-2">
        <StatusBadge status={booking.status} isPast={row.isPast} />
        {cancellable && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="rounded-full border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 px-3 py-1.5 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Cancelling…" : "Cancel"}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, isPast }: { status: TimeBlock["status"]; isPast: boolean }) {
  if (status === "cancelled") {
    return (
      <span className="text-xs rounded-full px-2 py-1 bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400">
        Cancelled
      </span>
    );
  }
  if (isPast) {
    return (
      <span className="text-xs rounded-full px-2 py-1 bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400">
        Past
      </span>
    );
  }
  return (
    <span className="text-xs rounded-full px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
      Confirmed
    </span>
  );
}
