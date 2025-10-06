    <html lang="fr">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}

import type { ReactNode } from "react";

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
    <html lang="fr">
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
