// Same approach as the Daily Brief app (see 05_Daily_Brief/lib/i18n.ts):
// public-facing booking flow only — the admin panel is Dan-only, so it
// stays English rather than doubling translation work for a page nobody
// else ever sees.

export type Lang = "en" | "ro";

export const DEFAULT_LANG: Lang = "en";
const LANG_KEY = "booking:lang";

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "ro";
}

// ?lang= wins — that's how the portfolio page links into this app, carrying
// the language the visitor already picked there. Otherwise fall back to a
// previously saved choice, then to English.
export function resolveInitialLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  const fromUrl = new URLSearchParams(window.location.search).get("lang");
  if (isLang(fromUrl)) return fromUrl;
  try {
    const saved = window.localStorage.getItem(LANG_KEY);
    if (isLang(saved)) return saved;
  } catch {
    // localStorage unavailable — fall through to the default
  }
  return DEFAULT_LANG;
}

export function saveLang(lang: Lang): void {
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    // localStorage unavailable (private mode, quota) — skip persistence
  }
}

export interface Strings {
  kicker: string;
  pickDay: string;
  sessionLength: (minutes: number) => string;
  capacity: (max: number) => string;
  resourceError: string;
  availabilityError: string;
  noSlotsThisDay: string;
  slotAvailable: (time: string) => string;
  slotBooked: (time: string) => string;
  earlierDays: string;
  laterDays: string;
  bookingLabel: string;
  nameLabel: string;
  emailLabel: string;
  peopleLabel: (max: number) => string;
  notesLabel: string;
  confirmBooking: string;
  bookingPending: string;
  cancel: string;
  chooseAnotherTime: string;
  bookingConfirmed: string;
  roomLabel: string;
  whenLabel: string;
  peopleShortLabel: string;
  bookedUnder: (email: string) => string;
  bookAnother: string;
  langAria: string;
  formErrors: {
    nameRequired: string;
    emailInvalid: string;
    wholeNumbersOnly: string;
    atLeastOne: string;
    maxCapacity: (max: number) => string;
    notesTooLong: string;
  };
  bookingErrors: {
    exclusionViolation: string;
    slotNotBookable: string;
    invalidInput: string;
    unknownResource: string;
    generic: string;
  };
}

export const STRINGS: Record<Lang, Strings> = {
  en: {
    kicker: "🔐 Escape Room",
    pickDay: "Pick a day, then an available time slot.",
    sessionLength: (m) => `${m}-minute sessions`,
    capacity: (max) => `Up to ${max} players`,
    resourceError: "Couldn't load this resource. Try refreshing.",
    availabilityError: "Couldn't load availability. Try refreshing.",
    noSlotsThisDay: "No slots available this day.",
    slotAvailable: (time) => `${time}, available`,
    slotBooked: (time) => `${time}, already booked`,
    earlierDays: "Earlier days",
    laterDays: "Later days",
    bookingLabel: "Booking",
    nameLabel: "Name",
    emailLabel: "Email",
    peopleLabel: (max) => `People (max ${max})`,
    notesLabel: "Notes (optional)",
    confirmBooking: "Confirm booking",
    bookingPending: "Booking…",
    cancel: "Cancel",
    chooseAnotherTime: "Choose a different time",
    bookingConfirmed: "Booking confirmed",
    roomLabel: "Room",
    whenLabel: "When",
    peopleShortLabel: "People",
    bookedUnder: (email) => `Booked under ${email}. Keep this reference to cancel later:`,
    bookAnother: "Book another slot",
    langAria: "Change language",
    formErrors: {
      nameRequired: "Name is required",
      emailInvalid: "Enter a valid email",
      wholeNumbersOnly: "Whole numbers only",
      atLeastOne: "At least 1 person",
      maxCapacity: (max) => `This room fits at most ${max}`,
      notesTooLong: "Keep it under 500 characters",
    },
    bookingErrors: {
      exclusionViolation: "That slot was just booked by someone else. Pick another time.",
      slotNotBookable:
        "That slot is no longer bookable — it may be in the past, too soon, or outside opening hours.",
      invalidInput: "Please check the number of people.",
      unknownResource: "This resource isn't available right now.",
      generic: "Something went wrong. Please try again.",
    },
  },
  ro: {
    kicker: "🔐 Cameră de evadare",
    pickDay: "Alege o zi, apoi un interval orar disponibil.",
    sessionLength: (m) => `Sesiuni de ${m} minute`,
    capacity: (max) => `Până la ${max} jucători`,
    resourceError: "Nu am putut încărca resursa. Încearcă să reîmprospătezi pagina.",
    availabilityError: "Nu am putut încărca disponibilitatea. Încearcă să reîmprospătezi pagina.",
    noSlotsThisDay: "Niciun interval disponibil în această zi.",
    slotAvailable: (time) => `${time}, disponibil`,
    slotBooked: (time) => `${time}, deja rezervat`,
    earlierDays: "Zile anterioare",
    laterDays: "Zile următoare",
    bookingLabel: "Rezervare",
    nameLabel: "Nume",
    emailLabel: "Email",
    peopleLabel: (max) => `Persoane (max ${max})`,
    notesLabel: "Notițe (opțional)",
    confirmBooking: "Confirmă rezervarea",
    bookingPending: "Se rezervă…",
    cancel: "Anulează",
    chooseAnotherTime: "Alege o altă oră",
    bookingConfirmed: "Rezervare confirmată",
    roomLabel: "Cameră",
    whenLabel: "Când",
    peopleShortLabel: "Persoane",
    bookedUnder: (email) => `Rezervat pe numele ${email}. Păstrează acest cod pentru anulare ulterioară:`,
    bookAnother: "Rezervă un alt interval",
    langAria: "Schimbă limba",
    formErrors: {
      nameRequired: "Numele este obligatoriu",
      emailInvalid: "Introdu un email valid",
      wholeNumbersOnly: "Doar numere întregi",
      atLeastOne: "Cel puțin 1 persoană",
      maxCapacity: (max) => `Această cameră permite maximum ${max}`,
      notesTooLong: "Maximum 500 de caractere",
    },
    bookingErrors: {
      exclusionViolation: "Acel interval tocmai a fost rezervat de altcineva. Alege o altă oră.",
      slotNotBookable:
        "Acel interval nu mai poate fi rezervat — poate fi trecut, prea aproape în timp sau în afara orarului.",
      invalidInput: "Verifică numărul de persoane.",
      unknownResource: "Această resursă nu este disponibilă momentan.",
      generic: "Ceva nu a mers bine. Încearcă din nou.",
    },
  },
};
