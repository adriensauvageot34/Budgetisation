import { redirect } from "next/navigation";
import { withProductAuthentication } from "@/app/product-query";
import { resolveLatestPublishedHistoryV2Month } from "@/server/query/runtime";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const latestMonth = await withProductAuthentication(
    resolveLatestPublishedHistoryV2Month,
  );
  if (latestMonth === null) redirect("/diagnostic");
  redirect(`/historique/${latestMonth}`);
}
