import "server-only";
import type { EconomicReferenceEntry } from "../month-reference";
import type { PlannedExpense, CostItem } from "../planned-expenses";
import { plannedAsset } from "@/domain/phase2/planned-assets";

export const SIMPLE_MAPPING_VERSION = "planner-simple-mappings@v1";
export type DiningDomain = "restaurants" | "fast-food" | "delivery";
/** Existing Canonical taxonomy names are the authority. No merchant heuristics. */
export function diningDomain(row: Pick<EconomicReferenceEntry, "subcategory" | "preciseType">): DiningDomain | null {
  if (row.preciseType === "Repas du midi au travail") return null;
  if (row.subcategory === "Livraison de repas") return "delivery";
  if (row.subcategory === "Fast-food / snack") return "fast-food";
  return row.subcategory === "Restaurant" ? "restaurants" : null;
}
export function externalDiningDomain(expense: PlannedExpense, line: CostItem): DiningDomain | null {
  const module = line.modulePath?.at(-1) ?? (line.assetKey ? plannedAsset(line.assetKey)?.module : null) ?? expense.subtypeKey;
  if (expense.context.purchaseMode === "DELIVERY" && ["restaurant", "fast_food"].includes(module ?? "")) return "delivery";
  return module === "fast_food" ? "fast-food" : module === "restaurant" ? "restaurants" : null;
}
/** This boundary is semantic, never a price threshold. Broad equipment labels stay unresolved. */
export function homeAssetBoundary(assetKey: string): "HOME_SMALL" | "HOME_PROJECT" | "NEEDS_MAPPING" {
  if (["home:storage", "home:decor", "home:plant", "home:dishes", "home:diy", "home:electric", "home:lamp"].includes(assetKey)) return "HOME_SMALL";
  if (["home:furniture", "home:bedding"].includes(assetKey)) return "HOME_PROJECT";
  return "NEEDS_MAPPING";
}
