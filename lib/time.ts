import type { Lang } from "@/lib/i18n";

// Every formatting helper takes an explicit IANA timezone and renders in it —
// never the browser's local zone. A client booking a Cluj escape room from
// London must see Cluj time, or "11:00" and "9:00" both look correct and mean
// different things.

function locale(lang: Lang): string {
  return lang === "ro" ? "ro-RO" : "en-GB";
}

export function formatSlotTime(iso: string, timeZone: string, lang: Lang = "en"): string {
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDayLabel(date: Date, timeZone: string, lang: Lang = "en"): string {
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

// yyyy-mm-dd in the resource's timezone — used as both a display key and a
// query param, so it must be stable regardless of the visitor's own zone.
export function dateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date); // en-CA = ISO order
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// Postgres/PostgREST render a tstzrange as text — e.g.
// ["2026-07-11 07:00:00+00","2026-07-11 08:00:00+00") — which is NOT ISO
// 8601 (space instead of "T", "+00" instead of "+00:00"). `new Date()`
// parsing of that exact shape happens to work in V8 (tested against Node),
// but the ECMAScript spec only guarantees the strict ISO format, so relying
// on that across browser engines would be an untested assumption. This
// converts to ISO 8601 explicitly instead — tested against Postgres's actual
// output, fractional seconds, and non-whole-hour offsets.
export function parseTstzRange(raw: string): [starts: string, ends: string] {
  const [startsRaw, endsRaw] = raw
    .replace(/^[[(]/, "")
    .replace(/[)\]]$/, "")
    .split(",")
    .map((s) => s.trim().replace(/^"|"$/g, ""));

  return [toISO(startsRaw), toISO(endsRaw)];
}

function toISO(pgTimestamp: string): string {
  const [datePart, timePart] = pgTimestamp.split(" ");
  const match = timePart.match(/^([\d:.]+)([+-]\d{2})(?::?(\d{2}))?$/);
  if (!match) throw new Error(`Unrecognized Postgres timestamp: ${pgTimestamp}`);
  const [, time, offsetHours, offsetMinutes = "00"] = match;
  return `${datePart}T${time}${offsetHours}:${offsetMinutes}`;
}
