"use client";

import { useState } from "react";
import {
  useCreateBookingMutation,
  BookingError,
  describeBookingError,
} from "@/lib/bookings";
import { bookingFormSchema, type BookingFormValues } from "@/lib/validation";
import { PG_ERROR } from "@/types/db";
import { formatDayLabel, formatSlotTime } from "@/lib/time";
import { useLang } from "@/components/LangProvider";
import type { AvailableSlot, BookingResult, Resource } from "@/types/db";

interface BookingFormProps {
  resource: Resource;
  slot: AvailableSlot;
  from: Date;
  days: number;
  onCancelSelection: () => void;
  onBooked: (result: BookingResult) => void;
}

const EMPTY_VALUES: BookingFormValues = { name: "", email: "", partySize: "2", notes: "" };

export default function BookingForm({
  resource,
  slot,
  from,
  days,
  onCancelSelection,
  onBooked,
}: BookingFormProps) {
  const { lang, t } = useLang();
  const [values, setValues] = useState<BookingFormValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof BookingFormValues, string>>>(
    {}
  );

  const mutation = useCreateBookingMutation(resource.slug, from, days);
  const wasOutbid = mutation.error instanceof BookingError
    && mutation.error.code === PG_ERROR.EXCLUSION_VIOLATION;

  function handleChange<K extends keyof BookingFormValues>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const schema = bookingFormSchema(resource.capacity, lang);
    const result = schema.safeParse(values);

    if (!result.success) {
      const errors: Partial<Record<keyof BookingFormValues, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof BookingFormValues;
        if (!errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    mutation.mutate(
      {
        slug: resource.slug,
        slot,
        name: result.data.name,
        email: result.data.email,
        partySize: result.data.partySize,
        notes: result.data.notes,
      },
      { onSuccess: onBooked }
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      // Without this, the number input's min/max attributes trigger the
      // browser's native constraint validation, which blocks submission (and
      // shows its own tooltip) BEFORE handleSubmit ever runs — so the styled
      // zod error below for an over-capacity party size would never actually
      // render; the browser's inconsistent-looking native bubble would show
      // instead, for that one field only. noValidate keeps min/max as
      // semantic/accessibility hints (spinner clamping, screen readers)
      // without letting them intercept submission.
      className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 space-y-4"
    >
      <div>
        <p className="text-neutral-500 dark:text-neutral-400 text-xs">{t.bookingLabel}</p>
        <p className="font-medium text-sm mt-0.5">
          {/* Derived from slot.starts_at, NOT the `from` prop — `from` is the
              availability window's start (today), needed only to key the
              mutation's cache invalidation to match useAvailabilityQuery.
              Using it here showed "today" as the date on every booking
              regardless of which day was actually picked. */}
          {formatDayLabel(new Date(slot.starts_at), resource.timezone, lang)} ·{" "}
          {formatSlotTime(slot.starts_at, resource.timezone, lang)}–
          {formatSlotTime(slot.ends_at, resource.timezone, lang)}
        </p>
      </div>

      <Field label={t.nameLabel} error={fieldErrors.name}>
        <input
          type="text"
          value={values.name}
          onChange={(e) => handleChange("name", e.target.value)}
          className={inputClass(!!fieldErrors.name)}
          autoComplete="name"
        />
      </Field>

      <Field label={t.emailLabel} error={fieldErrors.email}>
        <input
          type="email"
          value={values.email}
          onChange={(e) => handleChange("email", e.target.value)}
          className={inputClass(!!fieldErrors.email)}
          autoComplete="email"
        />
      </Field>

      <Field label={t.peopleLabel(resource.capacity)} error={fieldErrors.partySize}>
        <input
          type="number"
          min={1}
          max={resource.capacity}
          value={values.partySize}
          onChange={(e) => handleChange("partySize", e.target.value)}
          className={inputClass(!!fieldErrors.partySize)}
        />
      </Field>

      <Field label={t.notesLabel} error={fieldErrors.notes}>
        <textarea
          value={values.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          rows={2}
          className={inputClass(!!fieldErrors.notes)}
        />
      </Field>

      {mutation.isError && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
          {describeBookingError(mutation.error, lang)}
          {wasOutbid && (
            <button
              type="button"
              onClick={onCancelSelection}
              className="block mt-2 font-medium underline underline-offset-2"
            >
              {t.chooseAnotherTime}
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          style={{ background: "var(--accent)" }}
          className="flex-1 rounded-full text-white px-4 py-2 text-sm font-medium disabled:opacity-50 hover:brightness-110 transition"
        >
          {mutation.isPending ? t.bookingPending : t.confirmBooking}
        </button>
        <button
          type="button"
          onClick={onCancelSelection}
          disabled={mutation.isPending}
          className="rounded-full border border-neutral-200 dark:border-neutral-800 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {t.cancel}
        </button>
      </div>
    </form>
  );
}

function inputClass(hasError: boolean): string {
  return `w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-colors ${
    hasError
      ? "border-red-400 dark:border-red-700"
      : "border-neutral-200 dark:border-neutral-800 focus:border-[var(--accent)]"
  }`;
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">{label}</span>
      {children}
      {error && <span className="block text-xs text-red-600 dark:text-red-400 mt-1">{error}</span>}
    </label>
  );
}
