import { redirect } from "next/navigation";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { eligibleHistoryMonths } from "@/server/bootstrap/history-calendar";
import { withProductAuthentication } from "@/app/product-query";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const latestMonth = await withProductAuthentication(async () => {
    const context = await getBootstrapContext();
    return eligibleHistoryMonths(context.periods).at(-1) ?? null;
  });
  if (latestMonth === null) redirect("/diagnostic");
  redirect(`/historique/${latestMonth}?view=calendar`);
}
