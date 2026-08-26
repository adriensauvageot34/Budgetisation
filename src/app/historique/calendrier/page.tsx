import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { eligibleHistoryMonths } from "@/server/bootstrap/history-calendar";
import { withProductAuthentication } from "@/app/product-query";

export const metadata: Metadata = { title: "Calendar" };

export const dynamic = "force-dynamic";

export default async function CalendarIndexPage() {
  const latestMonth = await withProductAuthentication(async () => {
    const context = await getBootstrapContext();
    return eligibleHistoryMonths(context.periods).at(-1) ?? null;
  });
  if (latestMonth === null) redirect("/diagnostic");
  redirect(`/historique/calendrier/${latestMonth}`);
}
