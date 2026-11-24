import "server-only";
import Big from "big.js";
import { presetCreationFields } from "@/domain/phase2/planner/composer-presets";
import type { PlannerJsonObject } from "@/domain/phase2/planner/json";
import { PURCHASE_BASKET_FIELDS } from "@/domain/phase2/planner/purchase-basket";
import { reconstructedId } from "@/domain/phase2/planner/realized-month-entry";
import { emptyPlanSemanticState, parsePlanSemanticState, type PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import { validateContextGraph } from "./context-selections";
import type { RealizedBoard, RealizedCard, RealizedPayment } from "./realized-month";

type DraftLine = { key: string; label: string; amount: string; paymentId: string };
type Recipe = { template: string; preset?: string; main?: readonly [string, string]; extras?: readonly [string, string] };

function recipe(card: RealizedCard, lineCount: number): Recipe {
  if (card.id === "daily-alimentation__courses_alimentaires") return { template: "purchase", preset: "groceries-purchase" };
  if (card.art.assetKey === "scene:bar-closed") return { template: "night-out", preset: "bar-apero", main: ["main", "main"], extras: ["extras", "extra"] };
  switch (card.art.templateKey) {
    case "restaurant":
    case "fast-food":
    case "delivery":
      return { template: card.art.templateKey, main: ["meal", card.art.templateKey], extras: ["extras", "extra"] };
    case "activity":
      return { template: "activity", main: ["main", "activity"], extras: ["extras", "extra"] };
    case "night-out":
      return { template: "night-out", main: ["main", "main"], extras: ["extras", "extra"] };
    case "gift":
      return { template: "gift", main: ["item", "gift"], extras: ["extras", "extra"] };
    case "family-visit":
    case "friend-visit":
      return { template: card.art.templateKey, main: ["hospitality", "hospitality"] };
    default:
      return card.section === "events"
        ? { template: lineCount ? "activity" : "other-context", main: ["main", "activity"], extras: ["extras", "extra"] }
        : { template: "purchase" };
  }
}

/** A confirmed partial payment can seed its own intention. Its value is
 * removed from the source draft line, so the full bank amount is never counted twice. */
export function julyReconstructedLines(board: RealizedBoard) {
  const debits = new Map<string, { card: RealizedCard; payment: RealizedPayment; balance: Big }>(board.cards.flatMap(card => card.payments.filter(payment => payment.flow === "expense")
    .map(payment => [payment.id, { card, payment, balance: new Big(payment.amount).abs() }] as const)));
  const assignments = new Map<string, { card: RealizedCard; reference: NonNullable<RealizedCard["relatedPayments"]>[number] }[]>();
  for (const card of board.cards) for (const reference of card.relatedPayments ?? []) {
    if (card.section === "flows" || !reference.component || reference.component.amount === null) continue;
    const list = assignments.get(reference.component.key) ?? [];
    list.push({ card, reference });
    assignments.set(reference.component.key, list);
  }
  const lines = new Map<string, DraftLine[]>();
  const add = (card: RealizedCard, line: DraftLine) => {
    const values = lines.get(card.id) ?? [];
    values.push(line);
    lines.set(card.id, values);
  };
  for (const choices of assignments.values()) {
    if (choices.length !== 1) continue;
    const { card, reference } = choices[0]!;
    const source = debits.get(reference.id), component = reference.component!;
    const amount = new Big(component.amount!);
    if (!source || source.card.id === card.id || !amount.gt(0) || amount.gt(source.balance)) continue;
    source.balance = source.balance.minus(amount);
    add(card, { key: component.key, label: reference.label, amount: amount.toFixed(2), paymentId: source.payment.id });
  }
  for (const { card, payment, balance } of debits.values()) {
    if (balance.eq(0) && !new Big(payment.amount).eq(0)) continue;
    const label = [payment.label, payment.category !== payment.label ? payment.category : undefined,
      card.payments.length > 1 ? `${payment.date.slice(8, 10)}/${payment.date.slice(5, 7)}` : undefined].filter(Boolean).join(" · ");
    add(card, { key: payment.id, label, amount: balance.toFixed(2), paymentId: payment.id });
  }
  return lines;
}

export function reconstructJulyDraft(board: RealizedBoard) {
  const linesByCard = julyReconstructedLines(board);
  const contexts: PlannedContextState[] = [];
  for (const card of board.cards) {
    if (card.section === "flows") continue;
    const id = reconstructedId(board.month, card.id), lines = linesByCard.get(card.id) ?? [];
    const shape = recipe(card, lines.length);
    const date = card.date ?? (card.payments.length === 1 ? card.payments[0]!.date : undefined);
    const dateFields: PlannerJsonObject = date?.startsWith(`${board.month}-`) ? { plannedDate: date } : {};
    const start = { contextOccurrenceId: id, templateKey: shape.template, status: "ACTIVE", provenance: "EXPLICIT_USER_DECISION" } as const;
    const item = (line: DraftLine, optionKey: string, basket = false): PlannerJsonObject => ({
      selectionId: reconstructedId(board.month, `${card.id}:${line.key}`), optionKey, kind: "COMPONENT", label: line.label.slice(0, 1024),
      quantity: "1", unitBasis: "ITEM", cost: { kind: "MANUAL", unitAmount: line.amount }, binding: { mode: "NO_RELATED_SLOT" },
      provenance: "EXPLICIT_USER_DECISION", ...(basket ? { basketArticle: { unit: "UNIT" } } : {}),
    });
    const fields: PlannerJsonObject = {
      ...presetCreationFields(shape.template, shape.preset), label: card.label, ...dateFields,
      ...(card.work ? { participantRefs: [card.work.participant],
        ...(card.places?.[0] ? { placeRef: { kind: "TEXT", label: card.places[0].label } } : {}) } : {}),
      ...(shape.template === "purchase" ? { fieldSchemaVersion: PURCHASE_BASKET_FIELDS,
        ...(shape.preset === "groceries-purchase" ? { basketCoverage: "EXTRA_TO_SLOT" } : {}) } : {}),
      ...(shape.template === "night-out" && card.endDate?.startsWith(`${board.month}-`) ? { endDate: card.endDate } : {}),
    };
    const slots: Record<string, PlannerJsonObject> = {};
    if (shape.template === "purchase") slots.item = { items: lines.map(line => item(line, "item", true)) };
    if (shape.main && lines[0]) slots[shape.main[0]] = { items: [item(lines[0], shape.main[1])] };
    if (shape.extras && lines.length > 1) slots[shape.extras[0]] = { items: lines.slice(1).map(line => item(line, shape.extras![1])) };
    if (shape.main?.[0] === "hospitality" && lines.length > 1) {
      const childId = reconstructedId(board.month, `${card.id}:complements`);
      slots.activities = { items: [{ selectionId: reconstructedId(board.month, `${card.id}:child`), kind: "CHILD_CONTEXT",
        optionKey: "purchase", childContextOccurrenceId: childId, provenance: "EXPLICIT_USER_DECISION" }] };
      contexts.push({ ...start, contextOccurrenceId: childId, parentContextOccurrenceId: id, templateKey: "purchase",
        fields: { label: "Autres dépenses de la visite", fieldSchemaVersion: PURCHASE_BASKET_FIELDS, ...dateFields },
        slotSelections: { item: { items: lines.slice(1).map(line => item(line, "item", true)) } } });
    }
    contexts.push({ ...start, fields, slotSelections: slots });
  }
  const state = parsePlanSemanticState({ ...emptyPlanSemanticState(board.month), contexts });
  validateContextGraph(state);
  return state;
}
