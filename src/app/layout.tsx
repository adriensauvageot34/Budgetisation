import type { Metadata } from "next";
import "@/app/globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { ExplorationRuntimeHost, ProductRuntimeProvider } from "@/components/runtime";

export const metadata: Metadata = {
  title: {
    default: "Budgetisation",
    template: "%s · Budgetisation",
  },
  description: "Historique, analyses et preuves financières de Budgetisation V2.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        <ProductRuntimeProvider>
          <AppShell>{children}</AppShell>
          <ExplorationRuntimeHost />
        </ProductRuntimeProvider>
      </body>
    </html>
  );
}
