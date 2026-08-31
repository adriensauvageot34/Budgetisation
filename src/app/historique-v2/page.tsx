import { redirect } from "next/navigation";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { eligibleHistoryMonths } from "@/server/bootstrap/history-calendar";
import { withProductAuthentication } from "@/app/product-query";

export const dynamic = "force-dynamic";

export default async function HistoryV2IndexRoute() {
  const context = await withProductAuthentication(() => getBootstrapContext());
  const months = eligibleHistoryMonths(context.periods);
  const latest = months.at(-1);
  redirect(latest === undefined ? "/diagnostic" : `/historique-v2/${latest}?view=calendar`);
}
