export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 font-sans antialiased transition-colors dark:bg-slate-900 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}

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
