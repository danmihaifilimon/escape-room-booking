// Every formatting helper takes an explicit IANA timezone and renders in it —
// never the browser's local zone. A client booking a Cluj escape room from
// London must see Cluj time, or "11:00" and "9:00" both look correct and mean
// different things.

export function formatSlotTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDayLabel(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
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
