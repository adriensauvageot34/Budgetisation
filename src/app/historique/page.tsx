import { redirect } from "next/navigation";
import { resolveLatestBankOperationMonth } from "@/server/query/runtime";
import { withProductAuthentication } from "@/app/product-query";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const latestMonth = await withProductAuthentication(resolveLatestBankOperationMonth);
  if (latestMonth === null) redirect("/diagnostic");
  redirect(`/historique/calendrier/${latestMonth}`);
}
