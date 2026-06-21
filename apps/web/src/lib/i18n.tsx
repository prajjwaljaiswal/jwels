'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Site-wide language state for the vendor marketing site. One source of truth so the
// header toggle switches every page, and the choice persists across reloads + routes.
export type Lang = 'en' | 'hi';

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (en: string, hi: string) => string;
};

const LangContext = createContext<Ctx | null>(null);
const STORAGE_KEY = 'vol-lang';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  // Hydrate the saved choice after mount (SSR renders English).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'hi' || saved === 'en') setLangState(saved);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { document.documentElement.lang = lang; } catch { /* ignore */ }
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  }, []);

  const t = useCallback((en: string, hi: string) => (lang === 'hi' ? hi : en), [lang]);

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLang(): Ctx {
  const ctx = useContext(LangContext);
  // Defensive fallback so a stray usage outside the provider renders English instead of crashing.
  if (!ctx) return { lang: 'en', setLang: () => {}, t: (en) => en };
  return ctx;
}
