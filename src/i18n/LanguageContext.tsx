import * as React from "react";
import ja, { TranslationKey, Translations } from "i18n/ja";
import en from "i18n/en";

export type Lang = "ja" | "en";
export type Localized<T> = Record<Lang, T>;

const translations: Localized<Translations> = { ja, en };
const STORAGE_KEY = "lang";

const isLang = (value: unknown): value is Lang =>
  value === "ja" || value === "en";

/** Saved choice first, then the browser's preferred languages, then Japanese. */
function getInitialLang(): Lang {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // localStorage can throw when storage is disabled
  }
  const preferred = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const tag of preferred) {
    const base = tag?.toLowerCase().split("-")[0];
    if (isLang(base)) return base;
  }
  return "ja";
}

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = React.createContext<LanguageContextValue | undefined>(
  undefined
);

export function LanguageProvider(props: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>(getInitialLang);

  const setLang = React.useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // the choice just won't survive a reload
    }
  }, []);

  const t = React.useCallback<LanguageContextValue["t"]>(
    (key, params) =>
      translations[lang][key].replace(/\{(\w+)\}/g, (match, name) =>
        params && name in params ? String(params[name]) : match
      ),
    [lang]
  );

  React.useEffect(() => {
    document.documentElement.lang = lang;
    document.title = translations[lang]["meta.title"];
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", translations[lang]["meta.description"]);
  }, [lang]);

  const value = React.useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return (
    <LanguageContext.Provider value={value}>
      {props.children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = React.useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside a LanguageProvider");
  }
  return context;
}
