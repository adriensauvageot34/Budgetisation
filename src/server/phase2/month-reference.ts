import "server-only";

import Big from "big.js";
import type { ForecastRange } from "./month-forecast";

export const RESTAURANT_SUBCATEGORIES = ["Restaurant", "Fast-food / snack", "Livraison de repas"] as const;
export const TOBACCO_SUBCATEGORIES = ["Bureau de tabac / presse", "Cannabis", "Vape / cigarette électronique"] as const;
export const REFERENCE_SUBCATEGORIES = ["Courses alimentaires", ...TOBACCO_SUBCATEGORIES,
  ...RESTAURANT_SUBCATEGORIES, "Boulangerie", "Café au travail"] as const;

export type EconomicReferenceEntry = Readonly<{ operationId: string; date: string; amount: string;
  subcategory: string; person: string | null; preciseType: string | null; merchant: string | null }>;
export type MobilityReferenceLeg = Readonly<{ date: string; origin: string; destination: string; fuelCost: string }>;
export type MonthReferenceEvidence = Readonly<{ startMonth: string; endMonth: string;
  economicEntries: readonly EconomicReferenceEntry[]; mobilityLegs: readonly MobilityReferenceLeg[] }>;
export type StatisticalComponent = ForecastRange & Readonly<{ key: string; method: string;
  observationCount: number; provenance: readonly string[]; note: string | null }>;
export type MonthReferencePlan = Readonly<{ targetMonth: string; necessary: readonly StatisticalComponent[];
  flexible: readonly StatisticalComponent[]; necessaryTotal: ForecastRange; flexibleTotal: ForecastRange;
  restaurantCorpus: readonly string[]; excludedRestaurantSubcategories: readonly string[];
  estimatedDays: Readonly<Record<string, { day: number; observationCount: number; certainty: "HISTORICAL_ESTIMATE" }>> }>;

const numeric = (value: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new TypeError("REFERENCE_AMOUNT_INVALID");
  return parsed;
};
const cents = (value: number | Big) => new Big(value).round(2).toFixed(2);
const integer = (value: number) => new Big(value).round(0).toFixed(2);
const quantile = (values: readonly number[], fraction: number): number => {
  if (!values.length) throw new TypeError("REFERENCE_SUPPORT_EMPTY");
  const ordered = [...values].sort((a, b) => a - b);
  const index = (ordered.length - 1) * fraction;
  const lower = Math.floor(index);
  return ordered[lower]! + (ordered[Math.ceil(index)]! - ordered[lower]!) * (index - lower);
};
const monthSequence = (start: string, end: string): string[] => {
  const months: string[] = [];
  const cursor = new Date(`${start}-01T12:00:00Z`);
  while (cursor.toISOString().slice(0, 7) <= end) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
};
const total = (parts: readonly StatisticalComponent[]): ForecastRange => ({
  low: parts.reduce((sum, part) => sum.plus(part.low!), new Big(0)).toFixed(2),
  central: parts.reduce((sum, part) => sum.plus(part.central!), new Big(0)).toFixed(2),
  high: parts.reduce((sum, part) => sum.plus(part.high!), new Big(0)).toFixed(2),
});
const workdays = (targetMonth: string): number => {
  const [year, month] = targetMonth.split("-").map(Number);
  const days = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  let count = 0;
  for (let day = 1; day <= days; day += 1) {
    const weekday = new Date(Date.UTC(year!, month! - 1, day)).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
};

export function buildMonthReference(evidence: MonthReferenceEvidence, targetMonth: string,
  recurrenceDates: readonly { componentKey: string; date: string }[]): MonthReferencePlan {
  const months = monthSequence(evidence.startMonth, evidence.endMonth);
  if (months.length !== 12) throw new TypeError("REFERENCE_TWELVE_MONTH_SUPPORT_REQUIRED");
  const rows = evidence.economicEntries.filter((entry) => entry.date.slice(0, 7) >= evidence.startMonth
    && entry.date.slice(0, 7) <= evidence.endMonth);
  const monthly = (matches: (entry: EconomicReferenceEntry) => boolean) => months.map((month) =>
    rows.filter((entry) => entry.date.startsWith(month) && matches(entry))
      .reduce((sum, entry) => sum.plus(entry.amount), new Big(0)).toNumber());
  const distribution = (key: string, values: readonly number[], count: number, method: string,
    provenance: readonly string[], note: string | null = null, roundCentral = false): StatisticalComponent => ({
    key, low: integer(quantile(values, 0.25)), central: roundCentral ? integer(quantile(values, 0.5)) : cents(quantile(values, 0.5)),
    high: integer(quantile(values, 0.75)), method, observationCount: count, provenance, note,
  });
  const groceriesRows = rows.filter((entry) => entry.subcategory === "Courses alimentaires");
  const tobaccoRows = rows.filter((entry) => TOBACCO_SUBCATEGORIES.some((name) => name === entry.subcategory));
  const restaurantRows = rows.filter((entry) => RESTAURANT_SUBCATEGORIES.some((name) => name === entry.subcategory));
  const groceries = distribution("groceries", monthly((entry) => entry.subcategory === "Courses alimentaires"),
    groceriesRows.length, "MONTHLY_P25_MEDIAN_P75_12M", ["financial_economic_cost_canonical", "subcategory:Courses alimentaires"], null, true);
  const tobacco = distribution("tobacco-vape", monthly((entry) => TOBACCO_SUBCATEGORIES.some((name) => name === entry.subcategory)),
    tobaccoRows.length, "MONTHLY_P25_MEDIAN_P75_12M", ["financial_economic_cost_canonical", ...TOBACCO_SUBCATEGORIES], null, true);
  const restaurants = distribution("household-restaurants", monthly((entry) => RESTAURANT_SUBCATEGORIES.some((name) => name === entry.subcategory)),
    restaurantRows.length, "MONTHLY_P25_MEDIAN_P75_12M", ["financial_economic_cost_canonical", ...RESTAURANT_SUBCATEGORIES]);
  const adrienMealsRows = rows.filter((entry) => entry.subcategory === "Boulangerie"
    && entry.person === "Adrien" && entry.preciseType === "Repas du midi au travail");
  const adrienMeals = distribution("adrien-work-meals", monthly((entry) => adrienMealsRows.includes(entry)),
    adrienMealsRows.length, "MONTHLY_P25_MEDIAN_P75_12M", ["financial_economic_cost_canonical", "person:Adrien", "type:Repas du midi au travail"], null, true);
  const manonMealsRows = rows.filter((entry) => entry.subcategory === "Boulangerie"
    && entry.person === "Manon" && entry.preciseType === "Repas du midi au travail");
  if (manonMealsRows.length === 0) throw new TypeError("MANON_MEAL_UNIT_COST_UNKNOWN");
  const days = workdays(targetMonth);
  const unitMealCost = new Big(manonMealsRows.reduce((sum, entry) => sum.plus(entry.amount), new Big(0)))
    .div(manonMealsRows.length).round(2);
  const manonMealHigh = unitMealCost.times(days);
  const manonMeals: StatisticalComponent = { key: "manon-work-meals", low: "0.00", central: cents(manonMealHigh.div(2)),
    high: integer(manonMealHigh.toNumber()), method: "WORKDAY_SCENARIO_OBSERVED_UNIT_COST",
    observationCount: manonMealsRows.length, provenance: ["financial_economic_cost_canonical", "person:Manon", "type:Repas du midi au travail"],
    note: "The central value is the midpoint of a scenario, not a historical monthly median." };
  const cafeRows = rows.filter((entry) => entry.subcategory === "Café au travail");
  const byDay = new Map<string, Big>();
  for (const entry of cafeRows) byDay.set(entry.date, (byDay.get(entry.date) ?? new Big(0)).plus(entry.amount));
  const cafeDays = [...byDay.values()].map((value) => value.toNumber());
  const home = "Domicile Adrien & Manon";
  const office = "Promotrans – Montpellier";
  const lunch = "Marie Blachère – Montpellier sud";
  const mobilityDays = new Map<string, { outbound?: number; inbound?: number; lunchOut?: number; lunchIn?: number }>();
  for (const leg of evidence.mobilityLegs) {
    const day = mobilityDays.get(leg.date) ?? {};
    const value = numeric(leg.fuelCost);
    if (leg.origin === home && leg.destination === office) day.outbound = (day.outbound ?? 0) + value;
    if (leg.origin === office && leg.destination === home) day.inbound = (day.inbound ?? 0) + value;
    if (leg.origin === office && leg.destination === lunch) day.lunchOut = (day.lunchOut ?? 0) + value;
    if (leg.origin === lunch && leg.destination === office) day.lunchIn = (day.lunchIn ?? 0) + value;
    mobilityDays.set(leg.date, day);
  }
  const commutes = [...mobilityDays.values()].flatMap((day) => day.outbound === undefined || day.inbound === undefined
    ? [] : [day.outbound + day.inbound]);
  const lunchDetours = [...mobilityDays.values()].flatMap((day) => day.lunchOut === undefined || day.lunchIn === undefined
    ? [] : [day.lunchOut + day.lunchIn]);
  if (commutes.length < 30 || lunchDetours.length === 0 || cafeDays.length < 30) throw new TypeError("REFERENCE_MOBILITY_OR_COFFEE_SUPPORT_INSUFFICIENT");
  const dailyCommute = new Big(quantile(commutes, 0.5)).round(2);
  const dailyLunchDetour = new Big(lunchDetours.reduce((sum, value) => sum + value, 0) / lunchDetours.length).round(2);
  const mobilityLow = dailyCommute.times(days);
  const mobilityHigh = dailyCommute.plus(dailyLunchDetour).times(days);
  const manonMobility: StatisticalComponent = { key: "manon-work-mobility",
    low: integer(mobilityLow.toNumber()), central: cents(new Big(integer(mobilityLow.toNumber())).plus(integer(mobilityHigh.toNumber())).div(2)),
    high: integer(mobilityHigh.toNumber()), method: "CANONICAL_MOBILITY_WORKDAY_SCENARIO",
    observationCount: commutes.length, provenance: ["mobility_legs", "route:home-promotrans", "route:promotrans-lunch"],
    note: "Fuel usage, not observed fuel purchases; assumes five onsite workdays per week." };
  const coffeeLow = new Big(days).times(2).div(5).times(quantile(cafeDays, 0.25));
  const coffeeCentral = new Big(days).times(2.5).div(5).times(quantile(cafeDays, 0.5));
  const coffeeHigh = new Big(days).times(3).div(5).times(Math.max(...cafeDays));
  const adrienCoffee: StatisticalComponent = { key: "adrien-work-coffee", low: integer(coffeeLow.toNumber()),
    central: cents(coffeeCentral), high: integer(coffeeHigh.toNumber()), method: "DECLARED_ATTRIBUTION_ONSITE_DAYS_X_DAILY_DISTRIBUTION",
    observationCount: cafeDays.length, provenance: ["financial_economic_cost_canonical", "subcategory:Café au travail", "declared:Bibal-attributed-to-Adrien"],
    note: "Attribution to Adrien is user declared; the operations have no person field." };
  const necessary = [groceries, tobacco, manonMobility];
  const flexible = [adrienMeals, manonMeals, adrienCoffee, restaurants];
  const bySeries = new Map<string, number[]>();
  for (const entry of recurrenceDates) {
    const daysForSeries = bySeries.get(entry.componentKey) ?? [];
    daysForSeries.push(Number(entry.date.slice(8, 10)));
    bySeries.set(entry.componentKey, daysForSeries);
  }
  const estimatedDays = Object.fromEntries([...bySeries].filter(([, observations]) => observations.length >= 3)
    .map(([key, observations]) => [key, { day: Math.round(quantile(observations, 0.5)),
      observationCount: observations.length, certainty: "HISTORICAL_ESTIMATE" as const }]));
  return { targetMonth, necessary, flexible, necessaryTotal: total(necessary), flexibleTotal: total(flexible),
    restaurantCorpus: [...RESTAURANT_SUBCATEGORIES],
    excludedRestaurantSubcategories: ["Bar", "Glacier / dessert", "Café / salon de thé", "Activité / loisir"], estimatedDays };
}
