"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_LANG, resolveInitialLang, saveLang, STRINGS, type Lang, type Strings } from "@/lib/i18n";

interface LangContextValue {
  lang: Lang;
  t: Strings;
  setLang: (lang: Lang) => void;
}

const LangContext = createContext<LangContextValue>({
  lang: DEFAULT_LANG,
  t: STRINGS[DEFAULT_LANG],
  setLang: () => {},
});

export default function LangProvider({ children }: { children: React.ReactNode }) {
  // Starts at DEFAULT_LANG so the client's first render matches the server's
  // (no ?lang= or localStorage access during SSR), then the effect swaps in
  // the real choice a moment later.
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    setLangState(resolveInitialLang());
  }, []);

  function setLang(next: Lang) {
    setLangState(next);
    saveLang(next);
  }

  return (
    <LangContext.Provider value={{ lang, t: STRINGS[lang], setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  return useContext(LangContext);
}
