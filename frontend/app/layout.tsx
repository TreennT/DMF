import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { LanguageProvider } from "../components/language-provider";
import { TopControls } from "../components/top-controls";

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
        <LanguageProvider>
          <TopControls />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
