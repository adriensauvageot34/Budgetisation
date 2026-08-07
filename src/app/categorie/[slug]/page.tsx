import { notFound } from "next/navigation";
import { budgetRepository } from "@/data";
import type { MonthKey } from "@/domain/budget";
import { CategoryDetail } from "@/features/category/category-detail";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ month?: string; hidden?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const months = budgetRepository.getMonths();
  const requestedMonth = query.month as MonthKey | undefined;
  const month = months.includes(requestedMonth as MonthKey)
    ? (requestedMonth as MonthKey)
    : months.at(-1)!;
  const categories = budgetRepository.getCategories();
  const hiddenSlugs = query.hidden?.split(",").filter(Boolean) ?? [];

  if (
    slug !== "autres" &&
    !categories.some((category) => category.slug === slug)
  ) {
    notFound();
  }

  return (
    <CategoryDetail
      slug={slug}
      month={month}
      hiddenSlugs={hiddenSlugs}
      months={months}
      operations={budgetRepository.getOperations()}
      categories={categories}
      accounts={budgetRepository.getAccounts()}
    />
  );
}
