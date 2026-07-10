"use client";

import { dateKey, formatSlotTime } from "@/lib/time";
import type { AvailableSlot } from "@/types/db";

interface SlotPickerProps {
  slots: AvailableSlot[];
  selectedDay: Date;
  selectedSlot: AvailableSlot | null;
  onSelect: (slot: AvailableSlot) => void;
  timeZone: string;
}

export default function SlotPicker({
  slots,
  selectedDay,
  selectedSlot,
  onSelect,
  timeZone,
}: SlotPickerProps) {
  const dayKey = dateKey(selectedDay, timeZone);
  const daySlots = slots.filter((s) => dateKey(new Date(s.starts_at), timeZone) === dayKey);

  if (daySlots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-5 text-sm text-neutral-500 dark:text-neutral-400">
        No slots available this day.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
      {daySlots.map((slot) => {
        const isSelected = selectedSlot?.starts_at === slot.starts_at;
        return (
          <button
            key={slot.starts_at}
            type="button"
            disabled={!slot.is_free}
            onClick={() => onSelect(slot)}
            aria-pressed={isSelected}
            aria-label={
              slot.is_free
                ? `${formatSlotTime(slot.starts_at, timeZone)}, available`
                : `${formatSlotTime(slot.starts_at, timeZone)}, already booked`
            }
            className={`h-11 rounded-lg text-sm font-medium transition-colors border ${
              !slot.is_free
                ? "border-transparent bg-neutral-100 text-neutral-300 line-through cursor-not-allowed dark:bg-neutral-900 dark:text-neutral-700"
                : isSelected
                  ? "border-transparent bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
            }`}
          >
            {formatSlotTime(slot.starts_at, timeZone)}
          </button>
        );
      })}
    </div>
  );
}
