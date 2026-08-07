import type { Metadata } from "next";
import "@/app/globals.css";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: {
    default: "Budgetisation",
    template: "%s · Budgetisation",
  },
  description:
    "Prototype d’analyse du budget historique partagé d’Adrien et Manon.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
