"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 3v2.25M12 18.75V21M4.221 4.221l1.59 1.59M18.189 18.189l1.59 1.59M3 12h2.25M18.75 12H21M4.221 19.779l1.59-1.59M18.189 5.811l1.59-1.59" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
      aria-hidden
    >
      <path
        d="M21 12.79A9 9 0 0 1 11.21 3 6.75 6.75 0 1 0 21 12.79Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("dmf-theme");
    const prefersDark = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false;
    const nextTheme: Theme = stored === "light" || stored === "dark" ? stored : prefersDark ? "dark" : "light";
    const root = document.documentElement;
    root.classList.toggle("dark", nextTheme === "dark");
    root.style.colorScheme = nextTheme;
    setTheme(nextTheme);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    window.localStorage.setItem("dmf-theme", theme);
  }, [mounted, theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="fixed right-6 top-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 shadow-sm backdrop-blur-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900/80"
      title={isDark ? "Passer au theme clair" : "Passer au theme sombre"}
      aria-label={isDark ? "Passer au theme clair" : "Passer au theme sombre"}
    >
      {isDark ? <SunIcon className="h-5 w-5 text-amber-400" /> : <MoonIcon className="h-5 w-5 text-slate-600 dark:text-slate-200" />}
    </button>
  );
}