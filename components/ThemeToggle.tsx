"use client";

import { useState } from "react";

export default function ThemeToggle() {
  // Reads the attribute the inline script in layout.tsx already set before
  // paint — matches it instead of localStorage directly so there's one
  // source of truth. suppressHydrationWarning below covers the one frame
  // where this can still legitimately differ from the server's static
  // default (server has no access to the user's saved/system preference).
  const [isDark, setIsDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-theme") === "dark"
  );

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Private browsing / storage disabled — theme just won't persist.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      suppressHydrationWarning
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm shadow-md flex items-center justify-center text-base hover:border-[var(--accent)] transition-colors"
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
