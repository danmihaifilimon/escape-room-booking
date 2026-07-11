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
                ? "text-white border-transparent shadow-sm shadow-indigo-500/30"
                : "border-neutral-200 text-neutral-600 hover:border-[var(--accent)] hover:text-[var(--accent)] dark:border-neutral-800 dark:text-neutral-400"
            }`}
            style={isSelected ? { background: "var(--accent)" } : undefined}
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
