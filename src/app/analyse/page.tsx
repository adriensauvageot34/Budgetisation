import { redirect } from "next/navigation";
import { yearMonthOf } from "@/core/time";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { withProductAuthentication } from "@/app/product-query";

export const metadata = { title: "Analyse" };

export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  const context = await withProductAuthentication(() => getBootstrapContext());
  const latest = context.periods.at(-1);
  if (latest === undefined) redirect("/diagnostic");
  redirect(`/historique/analyse/${yearMonthOf(latest.month)}`);
}
