"use client";

import Image from "next/image";
import { useLanguage } from "./language-provider";

type LanguageCode = "fr" | "en";

const FLAGS: Record<LanguageCode, { src: string; alt: string }> = {
  fr: {
    src: "/france.png",
    alt: "French flag",
  },
  en: {
    src: "/united-kingdom.png",
    alt: "United Kingdom flag",
  },
};

export function LanguageToggle() {
  const { language, setLanguage, content } = useLanguage();
  const { languageToggle } = content;

  const nextLanguage: LanguageCode = language === "fr" ? "en" : "fr";
  const { title, label } = languageToggle.languages[nextLanguage];
  const flag = FLAGS[nextLanguage];

  return (
    <button
      type="button"
      onClick={() => setLanguage(nextLanguage)}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-lg text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
      aria-label={title}
      title={title}
    >
      <Image src={flag.src} alt={flag.alt} width={24} height={24} priority />
      <span className="sr-only">{label}</span>
    </button>
  );
}