import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ThemeToggle } from "../components/theme-toggle";

export const metadata: Metadata = {
  title: "Validation DMF",
  description: "Interface pour visualiser et lancer la validation DMF",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}

};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
