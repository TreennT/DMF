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

  const handleSetTheme = (nextTheme: Theme) => {
    if (nextTheme === theme) return;
    setTheme(nextTheme);
  };

  return (
    <div className="fixed right-6 top-6 z-50 flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 p-1 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/80">
      <button
        type="button"
        onClick={() => handleSetTheme("light")}
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${theme === "light" ? "bg-indigo-500 text-white shadow" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/80"}`}
        aria-pressed={theme === "light"}
        title="Activer le thème clair"
      >
        <SunIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Clair</span>
      </button>
      <button
        type="button"
        onClick={() => handleSetTheme("dark")}
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${theme === "dark" ? "bg-indigo-500 text-white shadow" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/80"}`}
        aria-pressed={theme === "dark"}
        title="Activer le thème sombre"
      >
        <MoonIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Sombre</span>
      </button>
    </div>
  );
}
