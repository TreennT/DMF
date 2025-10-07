"use client";

import { LanguageToggle } from "./language-toggle";
import { ThemeToggle } from "./theme-toggle";

export function TopControls() {
  return (
    <div className="fixed right-6 top-6 z-50 flex items-center gap-3">
      <LanguageToggle />
      <ThemeToggle />
    </div>
  );
}
