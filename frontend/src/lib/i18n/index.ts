import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./en";
import { hi } from "./hi";

export type Language = "en" | "hi";
const STORAGE_KEY = "js_lang";

function initialLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "hi") return saved;
  } catch {
    /* storage blocked: fall through */
  }
  return navigator.language.toLowerCase().startsWith("hi") ? "hi" : "en";
}

export function setLanguage(language: Language): void {
  void i18n.changeLanguage(language);
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    /* storage blocked: the choice lasts for this visit only */
  }
}

i18n.on("languageChanged", (language) => {
  document.documentElement.lang = language;
});

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi } },
  lng: initialLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnObjects: true,
});

document.documentElement.lang = i18n.language;

export default i18n;
