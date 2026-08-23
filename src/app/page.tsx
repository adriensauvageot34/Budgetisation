import { redirect } from "next/navigation";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { yearMonthOf } from "@/core/time";
import { withProductAuthentication } from "@/app/product-query";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const context = await withProductAuthentication(() => getBootstrapContext());
  if (!context.household) redirect("/acces-refuse");
  const latest = context.periods.at(-1);
  if (latest === undefined) redirect("/diagnostic");
  redirect(`/historique/calendrier/${yearMonthOf(latest.month)}`);
}
