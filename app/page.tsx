"use client";

import { useMemo, useState } from "react";
import DaySelector, { buildDayRange } from "@/components/DaySelector";
import SlotPicker from "@/components/SlotPicker";
import BookingForm from "@/components/BookingForm";
import BookingConfirmation from "@/components/BookingConfirmation";
import SlotGridSkeleton from "@/components/skeletons/SlotGridSkeleton";
import LangProvider, { useLang } from "@/components/LangProvider";
import LangToggle from "@/components/LangToggle";
import { useAvailabilityQuery } from "@/lib/bookings";
import { useResourceQuery } from "@/lib/resources";
import type { AvailableSlot, BookingResult } from "@/types/db";

// Single-resource site for now — a [slug] route is a later concern, not
// something the current scope needs.
const RESOURCE_SLUG = "escape-cluj";
const VISIBLE_DAYS = 14; // just for this preview strip — the real cutoff is resource.horizon_days

// Scoped to just this page (not the root layout) — the admin panel is
// Dan-only, so it stays English rather than doubling translation work for a
// page nobody else ever sees.
export default function BookingPage() {
  return (
    <LangProvider>
      <BookingPageContent />
    </LangProvider>
  );
}

function BookingPageContent() {
  const { t } = useLang();
  const { data: resource, isPending: resourcePending, isError: resourceError } =
    useResourceQuery(RESOURCE_SLUG);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const days = useMemo(() => buildDayRange(today, VISIBLE_DAYS), [today]);
  const [selectedDay, setSelectedDay] = useState(days[0]);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [confirmed, setConfirmed] = useState<BookingResult | null>(null);

  const { data: slots, isPending: slotsPending, isError: slotsError } = useAvailabilityQuery(
    RESOURCE_SLUG,
    today,
    VISIBLE_DAYS
  );

  if (resourcePending) {
    return (
      <div className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="h-7 w-56 rounded bg-neutral-100 dark:bg-neutral-900 animate-pulse mb-2" />
        <div className="h-4 w-72 rounded bg-neutral-100 dark:bg-neutral-900 animate-pulse mb-8" />
        <SlotGridSkeleton />
      </div>
    );
  }

  if (resourceError || !resource) {
    return (
      <div className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-5 text-sm text-red-700 dark:text-red-400">
          {t.resourceError}
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <BookingConfirmation
          resource={resource}
          booking={confirmed}
          onBookAnother={() => {
            setConfirmed(null);
            setSelectedSlot(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <header className="mb-8 rounded-2xl overflow-hidden shadow-lg shadow-indigo-500/10">
        <div
          className="px-6 py-8 sm:px-8 sm:py-10 text-white"
          style={{
            background: "linear-gradient(135deg, var(--accent), var(--accent-dark))",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-100">
              {t.kicker}
            </p>
            <LangToggle />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-1">
            {resource.name}
          </h1>
          <p className="text-sm text-indigo-100/90 mt-2">{t.pickDay}</p>
          <div className="flex flex-wrap gap-2 mt-5">
            <Badge>⏱️ {t.sessionLength(resource.slot_minutes)}</Badge>
            <Badge>👥 {t.capacity(resource.capacity)}</Badge>
          </div>
        </div>
      </header>

      <section className="mb-6">
        <DaySelector
          days={days}
          selected={selectedDay}
          onSelect={(day) => {
            setSelectedDay(day);
            setSelectedSlot(null); // a slot picked on another day is no longer valid to show as selected
          }}
          timeZone={resource.timezone}
        />
      </section>

      <section className="mb-6">
        {slotsPending && <SlotGridSkeleton />}
        {slotsError && (
          <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-5 text-sm text-red-700 dark:text-red-400">
            {t.availabilityError}
          </div>
        )}
        {slots && (
          <SlotPicker
            slots={slots}
            selectedDay={selectedDay}
            selectedSlot={selectedSlot}
            onSelect={setSelectedSlot}
            timeZone={resource.timezone}
          />
        )}
      </section>

      {selectedSlot && (
        <BookingForm
          resource={resource}
          slot={selectedSlot}
          from={today}
          days={VISIBLE_DAYS}
          onCancelSelection={() => setSelectedSlot(null)}
          onBooked={setConfirmed}
        />
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-xs font-medium text-white">
      {children}
    </span>
  );
}
