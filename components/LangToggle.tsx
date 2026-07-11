"use client";

import { useLang } from "@/components/LangProvider";
import type { Lang } from "@/lib/i18n";

const OPTIONS: Lang[] = ["en", "ro"];

export default function LangToggle() {
  const { lang, setLang, t } = useLang();

  return (
    <div
      role="group"
      aria-label={t.langAria}
      className="flex rounded-full border border-white/30 overflow-hidden text-xs backdrop-blur-sm"
    >
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLang(option)}
          aria-pressed={lang === option}
          className={`px-2.5 py-1.5 font-medium uppercase transition-colors ${
            lang === option ? "bg-white/25 text-white" : "text-indigo-100 hover:text-white"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
