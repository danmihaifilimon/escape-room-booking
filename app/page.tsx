"use client";

import { useMemo, useState } from "react";
import DaySelector, { buildDayRange } from "@/components/DaySelector";
import SlotPicker from "@/components/SlotPicker";
import SlotGridSkeleton from "@/components/skeletons/SlotGridSkeleton";
import { useAvailabilityQuery } from "@/lib/bookings";
import { useResourceQuery } from "@/lib/resources";
import { formatSlotTime, formatDayLabel } from "@/lib/time";
import type { AvailableSlot } from "@/types/db";

// Single-resource site for now — a [slug] route is a later concern, not
// something the current scope needs.
const RESOURCE_SLUG = "escape-cluj";
const VISIBLE_DAYS = 14; // just for this preview strip — the real cutoff is resource.horizon_days

export default function BookingPage() {
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
          Couldn&apos;t load this resource. Try refreshing.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">{resource.name}</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Pick a day, then an available time slot.
        </p>
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
            Couldn&apos;t load availability. Try refreshing.
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

      {/* Booking form comes in step 4 — this just proves slot selection works. */}
      {selectedSlot && (
        <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 text-sm">
          <p className="text-neutral-500 dark:text-neutral-400">Selected</p>
          <p className="font-medium mt-1">
            {formatDayLabel(selectedDay, resource.timezone)} ·{" "}
            {formatSlotTime(selectedSlot.starts_at, resource.timezone)} –{" "}
            {formatSlotTime(selectedSlot.ends_at, resource.timezone)}
          </p>
        </section>
      )}
    </div>
  );
}
