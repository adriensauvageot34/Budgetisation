import "server-only";
import Big from "big.js";
import type { PlanningPlanSlot, UnresolvedBehavioralReserve } from "@/domain/phase2/planner/baseline-contract";
import { matchesForecastCategory } from "../remaining-month-forecast";
import { requiredForecastSources } from "../forecast-opportunities";
import type { EconomicReferenceEntry } from "../month-reference";
import type { PlanningBaselineSources } from "./baseline-sources";
import { closedMonths, compare, diagnostic, emptyValue, makeSlot, money, references, sourceRef, unique } from "./baseline-evidence";
import { referenceQuantile } from "../month-reference";

export const BASELINE_FOOD_MODEL = "planner-purchase-aware-food@v1";
export const foodIdentity = (row: EconomicReferenceEntry): string => row.purchaseEventId
  ? `purchase:${row.purchaseEventId}` : row.canonicalComponentKey ?? `operation:${row.operationId}`;
export const FOOD_KEYS = ["groceries", "household-restaurants", "adrien-work-meals", "manon-work-meals", "adrien-work-coffee"] as const;
/** Upstream purchase ownership has already replaced represented bank components. A conflict
 * at the same identity blocks instead of making the result depend on input row order. */
export function uniqueEconomicRows(rows: readonly EconomicReferenceEntry[]): EconomicReferenceEntry[] {
  const byId = new Map<string, EconomicReferenceEntry>();
  for (const row of rows) {
    const key = foodIdentity(row), previous = byId.get(key);
    if (previous && sourceRef(key, "canonical", previous).digest !== sourceRef(key, "canonical", row).digest)
      throw new TypeError(`BASELINE_ECONOMIC_IDENTITY_CONFLICT:${key}`);
    byId.set(key, row);
  }
  return [...byId.values()].sort((a, b) => compare(foodIdentity(a), foodIdentity(b)));
}
export function buildFoodBaseline(s: PlanningBaselineSources) {
  if (s.food.methodVersion !== "global_food_rhythm@v2-purchase-aware") throw new TypeError("BASELINE_PURCHASE_AWARE_FOOD_REQUIRED");
  const slots: PlanningPlanSlot[] = [], unresolvedReserves: UnresolvedBehavioralReserve[] = [], diagnostics = [];
  const sourceRefs = [];
  for (const key of FOOD_KEYS) {
    const sources = requiredForecastSources(key), months = closedMonths(s, sources), observedMonths = closedMonths(s, ["BANK"]);
    const evidenceMonths = unique([...months, ...observedMonths]);
    const rows = uniqueEconomicRows(s.evidence.history.economicEntries.filter(row => evidenceMonths.includes(row.date.slice(0, 7)) && matchesForecastCategory(key, row)));
    const foodMonths = s.food.months.filter(row => evidenceMonths.includes(row[0]));
    if (new Set(foodMonths.map(row => row[0])).size !== foodMonths.length) throw new TypeError("BASELINE_DUPLICATE_FOOD_MONTH");
    const sourceKey = `food:${key}`;
    const unknownPurchases = s.purchaseFacts.filter(f => f.timing.status === "KNOWN" && f.timing.economicMonth !== null && evidenceMonths.includes(f.timing.economicMonth)
      && ["UNKNOWN", "CONFLICT"].includes(f.economicAmount.status));
    const samples = evidenceMonths.map(month => {
      const entries = rows.filter(row => row.date.startsWith(month)), food = foodMonths.find(row => row[0] === month);
      const unresolved = unknownPurchases.some(f => f.timing.status === "KNOWN" && f.timing.economicMonth === month);
      const minimum = money(entries.reduce((n, row) => n.plus(row.amount), new Big(0)).toString());
      let value: string | null;
      if (key === "groceries") {
        // Use the FOOD economic owner, never the bank debit or wallet funding total.
        value = !unresolved && food && !(food[12][0] & 1) ? money(food[1]) : null;
      } else if (key === "household-restaurants") {
        // Payments/purchases are not semantic restaurant occurrences.
        value = !unresolved && food && Number(food[8][3]) === 1
          && s.periods.some(p => p.month.startsWith(month) && p.lifeStatus === "complete")
          ? String(food[8][1]) : null;
      } else {
        // Work-lunch purpose identifies the occurrence; count distinct dated meals,
        // not split payment legs. No hypothetical onsite midpoint is imported.
        value = !unresolved ? String(unique(entries.map(row => row.date)).length) : null;
      }
      if (!months.includes(month)) value = null;
      return { month, value, minimum: key === "groceries" && food ? money(food[1]) : key === "groceries" ? minimum : null,
        evidenceRefs: unique([...entries.map(foodIdentity), ...(food ? [`food-month:${month}`] : [])]) };
    });
    const history = references(key === "groceries" ? "ECONOMIC_AMOUNT" : "OCCURRENCE_COUNT", sources, samples);
    const known = history.range.central !== null;
    const personName = key.startsWith("adrien-") ? "Adrien" : key.startsWith("manon-") ? "Manon" : null;
    const people = Object.entries(s.evidence.personNamesById).filter(([, name]) => name === personName);
    if (personName && people.length !== 1) throw new TypeError("BASELINE_FOOD_PERSON_SCOPE_INVALID");
    const personId = personName ? people[0]![0] : null;
    const priced = rows.filter(row => history.comparableMonths.includes(row.date.slice(0, 7)) && row.amountStatus !== "PARTIAL");
    const restaurantPrices = foodMonths.filter(row => history.comparableMonths.includes(row[0])).flatMap(row => row[8][5].status === "KNOWN" ? [Number(row[8][5].value)] : []);
    const unit = key === "household-restaurants" ? restaurantPrices.length ? money(String(referenceQuantile(restaurantPrices, .5))) : null
      : key === "groceries" || !known || priced.length === 0 ? null
        : money(priced.reduce((n, row) => n.plus(row.amount), new Big(0)).div(unique(priced.map(row => row.date)).length).toString());
    const slot = makeSlot({ semanticKey: key, controlKey: key, kind: key === "groceries" ? "AMOUNT" : "OCCURRENCE",
      scope: personId ? { kind: "PERSON", personId } : { kind: "HOUSEHOLD" }, inclusion: known ? "CENTRAL" : "UNRESOLVED_RESERVE",
      baselineValue: { ...emptyValue(), amount: key === "groceries" ? history.range.central : null,
        count: key === "groceries" ? null : history.range.central, unitAmount: unit },
      historicalReferences: history, knowledge: known ? samples.some(sample => sample.value === null) ? "PARTIAL" : "ESTIMATED" : "UNKNOWN", provenance: ["CANONICAL_HISTORY"], sourceRefs: [sourceKey],
      capabilities: [{ action: key === "groceries" ? "SET_AMOUNT" : "SET_COUNT", availability: "AVAILABLE", reason: null }] });
    slots.push(slot);
    sourceRefs.push(sourceRef(sourceKey, s.food.methodVersion, { samples, personId, unknownPurchaseRefs: unique(unknownPurchases.map(f => f.purchaseIdentityKey)) }, history.evidenceRefs));
    if (!known || samples.some(sample => sample.value === null)) {
      diagnostics.push(diagnostic("BASELINE_LOCAL_FOOD_REFERENCE_UNAVAILABLE", key, history.evidenceRefs));
      unresolvedReserves.push({ reserveKey: `unresolved:${key}`, replacesSlotKey: slot.slotIdentityKey,
        reason: "LOCAL_REFERENCE_UNAVAILABLE", knowledge: samples.some(sample => sample.minimum !== null) ? "PARTIAL" : "UNKNOWN",
        value: { low: null, central: null, high: null }, historicalReferences: references(history.basis, sources,
          known ? samples.filter(sample => sample.value === null) : samples), sourceRefs: [sourceKey] });
    }
  }
  return { slots, unresolvedReserves, diagnostics, sourceRefs };
}
