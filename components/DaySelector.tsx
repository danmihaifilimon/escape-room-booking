"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, formatDayLabel } from "@/lib/time";
import { useLang } from "@/components/LangProvider";

interface DaySelectorProps {
  days: Date[];
  selected: Date;
  onSelect: (day: Date) => void;
  timeZone: string;
}

export default function DaySelector({ days, selected, onSelect, timeZone }: DaySelectorProps) {
  const { lang, t } = useLang();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  // The day list itself (its length/width) can change without a scroll
  // event ever firing, which would leave a stale arrow visible/hidden.
  useEffect(() => updateEdges(), [days, updateEdges]);

  function scrollPage(direction: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    // A few pills' worth per click — enough to feel like real progress
    // without a near-full-width jump the native scrollbar arrows didn't do
    // either, so it flew past too much of the strip at once.
    el.scrollBy({ left: direction * el.clientWidth * 0.4, behavior: "smooth" });
  }

  return (
    <div className="relative rounded-2xl border border-neutral-200 dark:border-neutral-800 p-2">
      <div
        ref={scrollerRef}
        onScroll={updateEdges}
        className="flex gap-2 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          // Fades the edge pills out instead of hard-cropping them, so a
          // partially-visible day at the boundary reads as "more to
          // scroll" rather than a rendering glitch. Only fades a side that
          // actually has more content past it — otherwise the fade cut
          // into the first/last day's own pill color (e.g. the selected
          // accent fill) whenever it sat flush against that edge, letting
          // the page background bleed into its corner.
          maskImage: `linear-gradient(to right, ${atStart ? "black" : "transparent"}, black 16px, black calc(100% - 16px), ${atEnd ? "black" : "transparent"})`,
          WebkitMaskImage: `linear-gradient(to right, ${atStart ? "black" : "transparent"}, black 16px, black calc(100% - 16px), ${atEnd ? "black" : "transparent"})`,
        }}
      >
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
              {formatDayLabel(day, timeZone, lang)}
            </button>
          );
        })}
      </div>

      {!atStart && (
        <button
          type="button"
          aria-label={t.earlierDays}
          onClick={() => scrollPage(-1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-md flex items-center justify-center text-sm hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          ←
        </button>
      )}
      {!atEnd && (
        <button
          type="button"
          aria-label={t.laterDays}
          onClick={() => scrollPage(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-md flex items-center justify-center text-sm hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          →
        </button>
      )}
    </div>
  );
}

// Builds the visible day strip: today through `horizonDays` out.
export function buildDayRange(from: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}
