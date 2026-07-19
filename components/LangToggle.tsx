"use client";

import { useLang } from "@/components/LangProvider";
import type { Lang } from "@/lib/i18n";

const OPTIONS: Lang[] = ["en", "ro"];

// Small flag glyphs, matching the main site's steag_svg() (gb for EN, ro tricolor).
function Flag({ lang }: { lang: Lang }) {
  const common = {
    viewBox: "0 0 20 15",
    width: 16,
    height: 12,
    "aria-hidden": true,
    className: "shrink-0 rounded-[2px] ring-1 ring-black/10",
  } as const;

  if (lang === "ro") {
    return (
      <svg {...common}>
        <rect width="20" height="15" fill="#002b7f" />
        <rect x="6.67" width="6.66" height="15" fill="#fcd116" />
        <rect x="13.33" width="6.67" height="15" fill="#ce1126" />
      </svg>
    );
  }

  // gb (simplified Union Jack)
  return (
    <svg {...common}>
      <rect width="20" height="15" fill="#012169" />
      <path d="M0 0 20 15M20 0 0 15" stroke="#fff" strokeWidth="3" />
      <path d="M0 0 20 15M20 0 0 15" stroke="#c8102e" strokeWidth="1.6" />
      <path d="M10 0v15M0 7.5h20" stroke="#fff" strokeWidth="5" />
      <path d="M10 0v15M0 7.5h20" stroke="#c8102e" strokeWidth="3" />
    </svg>
  );
}

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
          className={`flex items-center gap-1.5 px-2.5 py-1.5 font-medium uppercase transition-colors ${
            lang === option ? "bg-white/25 text-white" : "text-indigo-100 hover:text-white"
          }`}
        >
          <Flag lang={option} />
          {option}
        </button>
      ))}
    </div>
  );
}
