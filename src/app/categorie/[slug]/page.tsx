import { notFound } from "next/navigation";
import { getBudgetRepository } from "@/data";
import type { MonthKey } from "@/domain/budget";
import { CategoryDetail } from "@/features/category/category-detail";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ month?: string; hidden?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const repository = await getBudgetRepository();
  const [months, operations, categories, accounts] = await Promise.all([
    repository.getMonths(),
    repository.getOperations(),
    repository.getCategories(),
    repository.getAccounts(),
  ]);
  const requestedMonth = query.month as MonthKey | undefined;
  const month = months.includes(requestedMonth ?? "")
    ? requestedMonth!
    : months.at(-1);
  const hiddenSlugs = query.hidden?.split(",").filter(Boolean) ?? [];

  if (
    !month ||
    (slug !== "autres" &&
      !categories.some((category) => category.slug === slug))
  ) {
    notFound();
  }

  return (
    <CategoryDetail
      slug={slug}
      month={month}
      hiddenSlugs={hiddenSlugs}
      months={months}
      operations={operations}
      categories={categories}
      accounts={accounts}
    />
  );
}
