"use client";

import { formatDayLabel, formatSlotTime, parseTstzRange } from "@/lib/time";
import { useLang } from "@/components/LangProvider";
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
  const { lang, t } = useLang();
  const [startsAt, endsAt] = parseTstzRange(booking.slot);

  return (
    <section className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-5 text-sm">
      <p className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-400 mb-3">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs">
          ✓
        </span>
        {t.bookingConfirmed}
      </p>
      <dl className="space-y-1 text-neutral-700 dark:text-neutral-300">
        <Row label={t.roomLabel} value={resource.name} />
        <Row
          label={t.whenLabel}
          value={`${formatDayLabel(new Date(startsAt), resource.timezone, lang)} · ${formatSlotTime(
            startsAt,
            resource.timezone,
            lang
          )}–${formatSlotTime(endsAt, resource.timezone, lang)}`}
        />
        <Row label={t.nameLabel} value={booking.customer_name ?? ""} />
        <Row label={t.peopleShortLabel} value={String(booking.party_size)} />
      </dl>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-3">
        {/* No email is sent yet (that's optional, still unbuilt) — don't
            claim one went out. */}
        {t.bookedUnder(booking.customer_email ?? "")}{" "}
        <code className="font-mono">{booking.cancel_token}</code>
      </p>
      <button
        type="button"
        onClick={onBookAnother}
        style={{ background: "var(--accent)" }}
        className="mt-4 rounded-full text-white px-4 py-2 text-sm font-medium hover:brightness-110 transition"
      >
        {t.bookAnother}
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
