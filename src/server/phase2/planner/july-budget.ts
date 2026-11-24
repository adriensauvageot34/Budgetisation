import "server-only";
import Big from "big.js";
import { componentId } from "@/domain/phase2/planner/identity";
import type { MonthComposerReadModel } from "@/domain/phase2/planner/composer-contract";
import { JULY_COMPOSER_MONTH, JULY_PILOT_DATE, reconstructedId } from "@/domain/phase2/planner/realized-month-entry";
import { costItemCashTreatment } from "@/domain/phase2/planned-money";
import { buildMonthReference, referenceQuantile } from "../month-reference";
import { forecastRemainingMonth, matchesForecastCategory, type CostRange, type MonthPredictionEvidence } from "../remaining-month-forecast";
import { julyReconstructedLines, reconstructJulyDraft } from "./reconstruct-july-draft";
import type { RealizedBoard, RealizedCard, RealizedPayment } from "./realized-month";

const rangeKeys = ["low", "central", "high"] as const;
const categories = [
  { key: "groceries", label: "Courses alimentaires", essential: true },
  { key: "tobacco-vape", label: "Tabac et vape", essential: true },
  { key: "fuel", label: "Pleins de carburant", essential: true },
  { key: "adrien-work-meals", label: "Repas au travail · Adrien", essential: false },
  { key: "manon-work-meals", label: "Repas au travail · Manon", essential: false },
  { key: "adrien-work-coffee", label: "Cafés au travail · Adrien", essential: false },
  { key: "household-restaurants", label: "Restaurants et livraisons", essential: false },
  { key: "other", label: "Sorties, achats et autres postes", essential: false },
] as const;
type Category = typeof categories[number]["key"];
type BudgetLine = {
  id: string; owner: string; label: string; family: string;
  category: Category | "fixed"; date: string | null; amount: string | null; extra?: boolean;
};

function sum(values: Iterable<string | null>) {
  let total = new Big(0);
  for (const value of values) if (value !== null) total = total.plus(value);
  return total.toFixed(2);
}

function range(project: (key: typeof rangeKeys[number]) => Big | string | number): CostRange {
  const ordered = rangeKeys.map(key => new Big(project(key)).toFixed(2)).sort((a, b) => new Big(a).cmp(b));
  return { low: ordered[0]!, central: ordered[1]!, high: ordered[2]! };
}

function aboveZero(value: Big) {
  return value.lt(0) ? new Big(0) : value;
}

function futureDate(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(`${JULY_COMPOSER_MONTH}-`) && value > JULY_PILOT_DATE;
}

function paymentCategory(payment: RealizedPayment, card: RealizedCard): BudgetLine["category"] {
  if (card.section === "fixed") return "fixed";
  if (payment.category === "Carburant") return "fuel";
  const evidence = {
    operationId: payment.id, date: payment.date, amount: payment.amount, subcategory: payment.category ?? "",
    preciseType: payment.preciseType ?? null, person: card.work?.name ?? payment.participant ?? null, merchant: payment.label,
  };
  return categories.find(({ key }) => matchesForecastCategory(key, evidence))?.key ?? "other";
}

function expenseLines(board: RealizedBoard, status: "confirmed" | "planned") {
  return board.cards.filter(card => card.pilotStatus === status).flatMap(card => card.payments
    .filter(payment => payment.flow === "expense").map(payment => ({
      id: payment.id, owner: card.id, label: payment.label, family: card.label, category: paymentCategory(payment, card),
      date: status === "confirmed" ? payment.date : payment.activityDate ?? payment.date,
      amount: new Big(payment.amount).abs().toFixed(2),
    } satisfies BudgetLine)));
}

function draftExpenses(source: RealizedBoard, board: RealizedBoard, model: MonthComposerReadModel | null): BudgetLine[] {
  const planned = expenseLines(board, "planned");
  if (!model) return planned;
  const pastAndFutureSeeds = new Map([...julyReconstructedLines(source)].flatMap(([cardId, lines]) => lines
    .map(line => [reconstructedId(source.month, `${cardId}:${line.key}`), line.paymentId] as const)));
  const plannedByPayment = new Map(planned.map(line => [line.id, line]));
  const raw = new Map(model.semanticState.contexts.map(context => [context.contextOccurrenceId, context]));
  const initialDates = new Map(reconstructJulyDraft(source).contexts.map(context => [context.contextOccurrenceId, context.fields.plannedDate]));
  const cards = new Map(model.board.contexts.map(card => [card.contextOccurrenceId, card]));
  const groups = new Map(source.cards.map(card => [reconstructedId(source.month, card.id), card]));
  const seedByComponent = new Map(model.preview.compiled.contexts.flatMap(context => (context.componentSlots ?? [])
    .flatMap(slot => slot.selections.flatMap(selection => {
      const payment = pastAndFutureSeeds.get(selection.selectionId);
      return payment ? [[componentId(context.contextOccurrenceId, slot.slotKey, selection.selectionId), payment] as const] : [];
    }))));
  return model.preview.compiled.components.flatMap(component => {
    const id = component.contextOccurrenceId, context = id && raw.get(id);
    if (!context || !id || component.externalEntryId !== null
      || costItemCashTreatment({ assetKey: component.assetKey ?? null }) === "ECONOMIC_ONLY") return [];
    const root = context.parentContextOccurrenceId ? raw.get(context.parentContextOccurrenceId) ?? context : context;
    const base = groups.get(root.contextOccurrenceId);
    const sourcePayment = seedByComponent.get(component.componentId);
    const seed = sourcePayment ? plannedByPayment.get(sourcePayment) : null;
    if (sourcePayment && !seed) return []; // Booked and past pending facts do not become future intentions through editing.
    const currentDate = root.fields.plannedDate;
    const moved = currentDate !== initialDates.get(root.contextOccurrenceId);
    const date = moved || !seed ? component.plannedDate ?? (typeof currentDate === "string" ? currentDate : null) : seed.date;
    if (date && !futureDate(date)) return [];
    const label = cards.get(id)?.label ?? component.label;
    const category = seed?.category ?? (base?.section === "fixed" ? "fixed" : root.fields.budgetDomain === "groceries" ? "groceries"
      : ["restaurant", "fast-food", "delivery"].includes(root.templateKey) ? "household-restaurants" : "other");
    return [{
      id: component.componentId, owner: root.contextOccurrenceId, label: component.label, family: label,
      date, category, amount: component.evaluation.economicAmount,
      extra: !seed && component.binding.relation === "EXTRA_TO_SLOT",
    } satisfies BudgetLine];
  });
}

export function readJulyBudget(source: RealizedBoard, board: RealizedBoard, evidence: MonthPredictionEvidence, model: MonthComposerReadModel | null) {
  const confirmed = expenseLines(board, "confirmed");
  const planned = draftExpenses(source, board, model);
  const reference = buildMonthReference(evidence.history, JULY_COMPOSER_MONTH, [], { allowPartial: true });
  // The 15th is complete in the simulation. The remaining window starts the next morning.
  const forecast = forecastRemainingMonth(reference, evidence, "2026-07-16", [], {}, {}, "AS_OF_TEMPORAL");
  const intervals = new Map([...forecast.essential, ...forecast.optional].filter(item => item.observationCount > 0)
    .map(item => [item.key, item]));
  const fuelMonths = (evidence.completeMonthsBySource?.BANK ?? []).filter(month => month <= evidence.history.endMonth).sort().slice(-5);
  const fuelSamples = fuelMonths.map(month => sum(evidence.history.economicEntries
    .filter(entry => entry.subcategory === "Carburant" && entry.date.startsWith(month)).map(entry => entry.amount)));
  const fuelReference = fuelSamples.length >= 3 && fuelSamples.some(value => Number(value) > 0)
    ? { low: referenceQuantile(fuelSamples.map(Number), .25), central: referenceQuantile(fuelSamples.map(Number), .5),
      high: referenceQuantile(fuelSamples.map(Number), .75) } : null;

  const rows = categories.map(definition => {
    const recorded = sum(confirmed.filter(line => line.category === definition.key).map(line => line.amount));
    const intentions = planned.filter(line => line.category === definition.key);
    const priced = sum(intentions.map(line => line.amount));
    const habitual = sum(intentions.filter(line => !line.extra).map(line => line.amount));
    const estimate = intervals.get(definition.key)?.remainingForecastEconomic
      ?? (definition.key === "fuel" && fuelReference ? range(key => aboveZero(new Big(fuelReference[key]).minus(recorded))) : null);
    // The remaining habit excludes the confirmed transactions. The compatible part of Composer consumes this allowance.
    const balance = estimate ? range(key => aboveZero(new Big(estimate[key]).minus(habitual))) : null;
    const total = range(key => new Big(recorded).plus(priced).plus(balance?.[key] ?? "0"));
    return { ...definition, recorded, priced, balance, total, plannedCount: new Set(intentions.map(line => line.owner)).size,
      unpriced: intentions.filter(line => line.amount === null).length };
  });

  const fixed = confirmed.filter(line => line.category === "fixed"), upcoming = planned.filter(line => line.category === "fixed");
  const fixedConfirmed = sum(fixed.map(item => item.amount)), fixedPlanned = sum(upcoming.map(item => item.amount));
  const fixedTotal = sum([fixedConfirmed, fixedPlanned]);
  const totalExpenses = range(key => new Big(fixedTotal).plus(sum(rows.map(row => row.total[key]))));
  const recordedExpenses = new Big(board.totals.expense.amount).abs().toFixed(2);
  const strictMinimum = new Big(recordedExpenses).plus(fixedPlanned).plus(sum(rows.filter(row => row.essential)
    .map(row => new Big(row.total.low).minus(row.recorded).toFixed(2)))).toFixed(2);
  const receipts = board.cards.flatMap(card => card.pilotStatus === "confirmed" || card.pilotStatus === "planned" ? card.payments
    .filter(payment => payment.flow === "income" || payment.flow === "refund").map(payment => ({
      id: payment.id, label: payment.label, category: payment.category, amount: payment.amount, status: card.pilotStatus!,
      date: card.pilotStatus === "confirmed" ? payment.date : payment.activityDate ?? payment.date,
    })) : []).sort((a, b) => a.date.localeCompare(b.date));
  const confirmedIncome = sum(receipts.filter(item => item.status === "confirmed").map(item => item.amount));
  const plannedIncome = sum(receipts.filter(item => item.status === "planned").map(item => item.amount));
  const projectedIncome = sum([confirmedIncome, plannedIncome]);
  const final = range(key => new Big(projectedIncome).minus(totalExpenses[key]));
  const afterMinimum = new Big(projectedIncome).minus(strictMinimum).toFixed(2);
  const fixedCalendar = [...fixed.map(line => ({ ...line, status: "confirmed" as const })),
    ...upcoming.map(line => ({ ...line, status: "planned" as const }))].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  const mobility = intervals.get("manon-work-mobility");
  const datedProjects = new Map<string, BudgetLine[]>();
  for (const line of planned) if (line.category !== "fixed" && line.date) {
    const key = `${line.owner}:${line.date}`;
    datedProjects.set(key, [...(datedProjects.get(key) ?? []), line]);
  }
  const plannedCalendar = [...datedProjects].map(([id, lines]) => ({
    id, label: lines[0]!.family, date: lines[0]!.date!,
    amount: lines.every(line => line.amount !== null) ? sum(lines.map(line => line.amount)) : null,
  }));
  const dailyCalendarTotals: Record<string, string> = {};
  for (const entry of [...fixedCalendar, ...plannedCalendar]) if (entry.date && entry.amount !== null) {
    dailyCalendarTotals[entry.date] = sum([dailyCalendarTotals[entry.date] ?? "0", entry.amount]);
  }
  return {
    rows, totalExpenses, strictMinimum, afterMinimum, recordedExpenses, fixedConfirmed, fixedPlanned, fixedTotal, fixedCalendar, plannedCalendar, dailyCalendarTotals,
    receipts, confirmedIncome, plannedIncome, final, planned,
    hasSavedDraft: !!model, mobilityUsage: mobility?.projectedMonth ?? null, trainingThrough: evidence.history.endMonth,
  };
}
