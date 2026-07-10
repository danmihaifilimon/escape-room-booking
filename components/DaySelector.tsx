"use client";

import { addDays, formatDayLabel } from "@/lib/time";

interface DaySelectorProps {
  days: Date[];
  selected: Date;
  onSelect: (day: Date) => void;
  timeZone: string;
}

export default function DaySelector({ days, selected, onSelect, timeZone }: DaySelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
      {days.map((day) => {
        const isSelected = day.toDateString() === selected.toDateString();
        return (
          <button
            key={day.toDateString()}
            type="button"
            onClick={() => onSelect(day)}
            aria-pressed={isSelected}
            className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
              isSelected
                ? "bg-neutral-900 text-white border-transparent dark:bg-neutral-100 dark:text-neutral-900"
                : "border-neutral-200 text-neutral-600 hover:border-neutral-400 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-600"
            }`}
          >
            {formatDayLabel(day, timeZone)}
          </button>
        );
      })}
    </div>
  );
}

// Builds the visible day strip: today through `horizonDays` out.
export function buildDayRange(from: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}
