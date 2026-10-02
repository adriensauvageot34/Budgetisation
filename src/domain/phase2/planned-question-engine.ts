/** Contextual orchestration only: canonical money, assets, places and routes keep their owners. */
import type { PlannedExpenseContext, PlannedExpenseDraft, PlannedProjectContext, ProspectivePersonRef } from "./planned-contract";
import { changeBuilderContext, editBuilderDraft, itemizeBuilderCosts, setQuickTotal, type BuilderState } from "./planned-builder";
import { rootAssetModule, plannedAsset } from "./planned-assets";
import { intentForDraft, type BuilderIntent } from "./planned-ux";
import { derivePlannedPlaceRoles } from "./planned-place-rules";
import type { PlannedPlaceOption } from "./planned-places";
import { plannedContextModifiers, resolvePlannedContext, SOCIAL_CONTACTS_V1 } from "./planned-rules";
import { stopForPlace, ensurePrimaryRouteStop } from "./planned-routes";
import { projectLinkCompatible, projectCostComponent, projectNights, projectLodgingAvailable } from "./planned-project";
export { projectNights } from "./planned-project";

export type KnowledgeState = "KNOWN" | "INFERRED" | "LIKELY" | "AMBIGUOUS" | "IRRELEVANT" | "UNKNOWN";
export type KnowledgeMeta = Readonly<{ state: KnowledgeState; reason: string }>;
export type QuestionId = "partyKind" | "groceriesNature" | "tripKind" | "participants" | "workPerson" | "workMode"
  | "groupScope" | "socialParticipants"
  | "groceryFocus" | "automotiveKind"
  | "channel" | "contact" | "host" | "format" | "occasion" | "entity" | "date" | "moment" | "visitReturn"
  | "provider" | "seller" | "giftRecipient" | "transport" | "transportDetails" | "lodging" | "lodgingCost" | "costMode" | "costTotal"
  | "costDetails" | "costEstimate" | "addons" | "link" | "review";
export type WizardAnswer = string | null | Readonly<Record<string, unknown>>;
export type WizardSession = Readonly<{ answers: Partial<Record<QuestionId, WizardAnswer>>; history: readonly QuestionId[]; current: QuestionId | null; editScope?: readonly QuestionId[]; intentChosen?: boolean }>;
export const emptyWizardSession = (): WizardSession => ({ answers: {}, history: [], current: null });
export const wizardHasPreviousUserDecision = (session: WizardSession) => !!session.intentChosen || session.history.length > 0;
export type WizardEnvironment = Readonly<{ persons: readonly { personId: string; displayName: string }[]; places: readonly PlannedPlaceOption[];
  linkedProjects?: readonly { id: string; draft: PlannedExpenseDraft; status: string }[]; editedId?: string | null }>;
export type QuestionContext = Readonly<{ draft: PlannedExpenseDraft; session: WizardSession; env: WizardEnvironment; intent: BuilderIntent }>;
export type QuestionContract = Readonly<{ id: QuestionId; title: string | ((c: QuestionContext) => string); priority: number | ((c: QuestionContext) => number);
  when: (c: QuestionContext) => boolean; skip?: (c: QuestionContext) => boolean;
  dependsOn: readonly QuestionId[]; advanceMode: "AUTO" | "EXPLICIT";
}>;
const intents = (...values: BuilderIntent[]) => (c: QuestionContext) => values.includes(c.intent);
const always = () => true;
const delivery = (c: QuestionContext) => c.draft.context.purchaseMode === "DELIVERY" || c.draft.context.workMealMode === "DELIVERED";
const freeRoot = (c: QuestionContext) => c.draft.context.workMealMode === "FROM_HOME" || c.draft.context.noExpense;
const resolved = (c: QuestionContext) => resolvePlannedContext({ familyKey: c.draft.familyKey, subtypeKey: c.draft.subtypeKey,
  modifiers: plannedContextModifiers(c.draft.context, c.env.persons.find(p => p.personId === c.draft.context.participantPersonIds?.[0])?.displayName) });
const q = (id: QuestionId, title: QuestionContract["title"], priority: QuestionContract["priority"], when: QuestionContract["when"] = always,
  dependsOn: readonly QuestionId[] = [], advanceMode: QuestionContract["advanceMode"] = "AUTO", skip?: QuestionContract["skip"]): QuestionContract =>
  ({ id, title, priority, when, dependsOn, advanceMode, skip });

/** A finite shared plan, not nine React decision trees. Options/editors are presentation adapters. */
export const PROJECT_QUESTIONS: readonly QuestionContract[] = [
  q("partyKind", "Quelle soirée ?", 10, intents("party")),
  q("groceriesNature", "Quelles courses ?", 10, intents("groceries")),
  q("groceryFocus", "Que faut-il compléter ?", 11, c => c.intent === "groceries" && c.draft.context.groceriesNature === "TOP_UP", ["groceriesNature"]),
  q("automotiveKind", "Quel besoin pour la voiture ?", 18, c => c.intent === "purchase" && c.draft.subtypeKey === "automotive", ["entity"]),
  q("tripKind", "Quel déplacement ?", 10, intents("trip")),
  q("workPerson", "Pour qui est ce repas ?", 10, intents("work_meal")),
  q("channel", c => c.intent === "fast_food" ? "Comment prenez-vous ce repas ?" : "Comment l’acheter ?",
    c => c.intent === "fast_food" ? 10 : 55, intents("fast_food", "groceries", "purchase"), ["entity", "giftRecipient"], "AUTO",
    c => c.draft.subtypeKey === "gift" && !c.draft.context.project?.entity),
  q("participants", c => c.intent === "fast_food" ? "Pour combien de personnes payons-nous ?" : "Qui vient ?",
    c => c.intent === "trip" ? 40 : c.intent === "activity" || c.intent === "purchase" ? 25 : 15,
    c => c.intent !== "work_meal" && c.intent !== "groceries", [], "AUTO"),
  q("socialParticipants", "Qui vient ?", 26, c => c.draft.context.companionMode === "GROUP", ["participants"], "EXPLICIT"),
  q("contact", "Qui allez-vous voir ?", 20, intents("visit")),
  q("host", "Où se passe la soirée ?", 20, c => c.intent === "party" && c.draft.subtypeKey === "house_party", ["partyKind"]),
  q("format", "Quel moment ensemble ?", 25, c => c.intent === "visit" || c.intent === "groceries" && c.draft.context.groceriesNature === "OCCASION", ["groceriesNature", "contact"]),
  q("occasion", "Quelle occasion ?", c => c.intent === "restaurant" ? 40 : 27,
    c => ["restaurant", "visit", "party"].includes(c.intent) || c.intent === "groceries" && c.draft.context.groceriesNature === "OCCASION", ["groceriesNature"]),
  q("giftRecipient", "Pour qui est le cadeau ?", 18, c => c.intent === "purchase" && c.draft.subtypeKey === "gift", ["entity"], "EXPLICIT"),
  q("entity", c => ({ restaurant: "Quel restaurant ?", fast_food: "Quel restaurant ou snack ?", work_meal: "Quel commerce ?",
    groceries: "Quelle enseigne ?", party: c.draft.context.outingKind === "EVENT" ? "Quel événement ?" : "Quel établissement ?",
    activity: "Quelle activité ?", purchase: "Quel achat ?", trip: "Quelle destination ?", visit: "Où allez-vous ?" })[c.intent],
    c => ["activity", "purchase"].includes(c.intent) ? 10 : c.intent === "trip" ? 20 : c.intent === "restaurant" ? 50 : c.intent === "fast_food" ? 20 : 40,
    c => c.intent !== "visit" && !(c.intent === "party" && c.draft.subtypeKey === "house_party") && c.draft.context.workMealMode !== "FROM_HOME",
    ["partyKind", "workPerson", "workMode"], "AUTO"),
  q("date", c => c.intent === "trip" ? "Quand partez-vous ?" : "Quand ?", c => c.intent === "work_meal" ? 20 : 30,
    always, [], "AUTO", c => !!c.draft.plannedDate && c.session.answers.entity != null && typeof c.session.answers.entity === "object" && !!c.session.answers.entity.date),
  q("workMode", "Comment prévoyez-vous votre repas ?", 30, intents("work_meal"), ["workPerson"]),
  q("provider", "Qui livre ?", 60, delivery, ["channel", "workMode", "entity"]),
  q("seller", "Quel vendeur ou prestataire ?", 60, c => c.intent === "purchase" && !!c.draft.context.project?.entity && c.draft.context.project.channel !== "UNDECIDED", ["entity", "channel"], "AUTO"),
  q("link", "Ce projet accompagne-t-il un autre projet ?", 65, c => compatibleProjectLinks(c).length > 0, [], "AUTO"),
  q("transport", "Comment y allez-vous ?", 70, c => resolved(c).transport !== "FORBIDDEN"
    && (c.intent !== "purchase" || !!c.draft.context.project?.entity) && c.draft.context.workMealMode !== "FROM_HOME", ["entity", "seller", "contact", "host", "channel", "link"]),
  q("transportDetails", "Votre trajet", 75, c => !!c.draft.context.transportMode && c.draft.context.transportMode !== "FREE",
    ["transport", "entity", "contact", "host", "date", "moment", "visitReturn"], "EXPLICIT"),
  q("lodging", "Où dormirez-vous ?", 80, c => projectLodgingAvailable(c.draft), ["tripKind", "date", "entity"], "AUTO"),
  q("lodgingCost", "Votre hébergement", 81, c => projectLodgingAvailable(c.draft) && !!c.draft.context.project?.lodging && !["RELATIVE", "LATER"].includes(c.draft.context.project.lodging), ["lodging"], "EXPLICIT"),
  q("costMode", c => c.intent === "restaurant" ? "Quel budget pour la note ?" : "Quel budget ?", 90, c => c.draft.context.workMealMode !== "FROM_HOME", ["workMode"], "AUTO"),
  q("costTotal", "Votre budget", 95, c => c.session.answers.costMode === "TOTAL", ["costMode"], "EXPLICIT"),
  q("costDetails", c => c.intent === "restaurant" ? "Votre note" : c.intent === "groceries" ? "Votre panier" : "À prévoir", 95,
    c => c.session.answers.costMode === "DETAIL", ["costMode"], "EXPLICIT"),
  q("costEstimate", "Une estimation pour commencer", 95, c => c.session.answers.costMode === "ESTIMATE", ["costMode", "participants"], "EXPLICIT"),
  q("addons", "Compléter votre projet", 100, c => c.session.current === "addons", [], "EXPLICIT"),
  q("review", "Votre projet", 110, always, [], "EXPLICIT"),
];

export function compatibleProjectLinks(c: QuestionContext) {
  return (c.env.linkedProjects ?? []).filter(p => p.id !== c.env.editedId && p.status === "PLANNED" && !p.draft.context.project?.linkedProjectId
    && projectLinkCompatible(c.draft, p.draft));
}
export function wizardKnowledge(c: QuestionContext): Record<string, KnowledgeMeta> {
  const contact = c.draft.context.personVisited ?? c.draft.context.host;
  const place = c.draft.context.place?.kind === "KNOWN" ? c.env.places.find(p => p.placeId === (c.draft.context.place as { placeId: string }).placeId) : undefined;
  return {
    place: c.draft.context.place ? { state: contact?.kind === "CONTACT" ? "INFERRED" : "KNOWN", reason: contact?.kind === "CONTACT" ? "Lieu lié au contact" : "Lieu choisi" }
      : { state: resolved(c).place.field === "HIDDEN" ? "IRRELEVANT" : "UNKNOWN", reason: "Lieu non précisé" },
    transport: resolved(c).transport === "FORBIDDEN" ? { state: "IRRELEVANT", reason: "Aucun déplacement propre à ce projet" }
      : c.draft.context.transportMode ? { state: "KNOWN", reason: "Mode choisi" }
        : place?.carVisitDates12Months && place.carVisitDates12Months.length >= 3 ? { state: "LIKELY", reason: "Voiture souvent observée pour ce lieu" }
          : { state: "UNKNOWN", reason: "Mode non choisi" },
    cost: c.draft.context.project?.unpricedComponents?.length ? { state: "UNKNOWN", reason: "Budget à préciser" }
      : c.draft.costItems.length ? { state: "KNOWN", reason: "Coûts saisis" } : { state: "UNKNOWN", reason: "Budget non renseigné" },
    provider: !delivery(c) ? { state: "IRRELEVANT", reason: "Aucune livraison" } : c.draft.context.deliveryProviderKey
      ? { state: "KNOWN", reason: "Livreur choisi" } : { state: "AMBIGUOUS", reason: "Plusieurs livreurs possibles" },
    date: c.draft.plannedDate ? { state: c.session.answers.entity && typeof c.session.answers.entity === "object" && c.session.answers.entity.date ? "INFERRED" : "KNOWN", reason: "Date du projet" }
      : { state: "UNKNOWN", reason: "Date facultative non précisée" },
  };
}
export function visibleProjectQuestions(c: QuestionContext) {
  return PROJECT_QUESTIONS.filter(q => q.when(c) && !q.skip?.(c)).sort((a, b) =>
    (typeof a.priority === "function" ? a.priority(c) : a.priority) - (typeof b.priority === "function" ? b.priority(c) : b.priority));
}
export function nextUsefulQuestion(c: QuestionContext): QuestionContract {
  const questions = visibleProjectQuestions(c);
  return questions.find(q => q.id === c.session.current) ?? questions.find(q => c.session.answers[q.id] === undefined
    && (!c.session.editScope || c.session.editScope.includes(q.id))) ?? PROJECT_QUESTIONS.at(-1)!;
}
const dependenciesOf = (id: QuestionId): Set<QuestionId> => {
  const invalid = new Set<QuestionId>([id]);
  for (let pass = 0; pass < PROJECT_QUESTIONS.length; pass++) for (const q of PROJECT_QUESTIONS)
    if (q.dependsOn.some(dep => invalid.has(dep))) invalid.add(q.id);
  return invalid;
};
/** Back visits actual decisions. Deduced facts and hidden questions never enter this journal. */
export function backWizard(session: WizardSession): WizardSession {
  const history = [...session.history], current = history.pop() ?? null;
  return { ...session, history, current, editScope: undefined };
}
export function answerWizard(session: WizardSession, id: QuestionId, answer: WizardAnswer): WizardSession {
  const answers = { ...session.answers }, changed = answers[id] !== undefined && JSON.stringify(answers[id]) !== JSON.stringify(answer);
  const invalid = new Set<QuestionId>();
  if (changed) {
    for (const dep of dependenciesOf(id)) invalid.add(dep);
    invalid.delete(id);
    for (const dep of invalid) delete answers[dep];
  }
  answers[id] = answer;
  return { ...session, answers, current: null, history: [...session.history.filter(q => q !== id && !invalid.has(q)), id] };
}
export const jumpWizard = (session: WizardSession, current: QuestionId): WizardSession => ({ ...session, current,
  editScope: current === "review" ? [] : [...dependenciesOf(current)] });

/** Repair navigation uses the shared question vocabulary, not vanished legacy DOM anchors. */
export function projectRepairQuestion(c: QuestionContext, path: string): QuestionId {
  if (/return|visitTiming|exactTime|moment|plannedTime/u.test(path)) return "date";
  if (/date|timing/u.test(path)) return "date";
  if (/route|transport/u.test(path)) return c.draft.context.transportMode ? "transportDetails" : "transport";
  if (/provider/u.test(path)) return "provider";
  if (/participant|person/u.test(path)) return c.intent === "work_meal" ? "workPerson" : "participants";
  if (/gift/u.test(path)) return c.intent === "purchase" ? "giftRecipient" : "addons";
  if (/child|addon/u.test(path)) return "addons";
  if (/place|contact|context/u.test(path)) return c.intent === "visit" ? "contact" : c.draft.subtypeKey === "house_party" ? "host" : c.intent === "work_meal" ? "workMode" : "entity";
  return "costMode";
}

export function beginProjectV2(state: BuilderState, env: WizardEnvironment): BuilderState {
  if (state.draft.context.project?.version === 2) return state;
  const people = state.draft.context.participantPersonIds?.length ? state.draft.context.participantPersonIds : env.persons.map(p => p.personId);
  const time = state.draft.context.restaurant?.plannedTime ?? state.draft.context.visitTiming?.outbound.time ?? state.draft.context.route?.plannedTime;
  return editBuilderDraft(state, { ...state.draft, context: { ...state.draft.context,
    ...(state.draft.context.restaurant && !state.draft.context.restaurant.priceBasis && state.draft.costItems.length ? { restaurant: { ...state.draft.context.restaurant, priceBasis: "DETAILED" as const } } : {}),
    project: { version: 2, financialScope: { personIds: people, count: Math.max(1, people.length) }, ...(time ? { moment: "EXACT", exactTime: time } : {}) } } });
}
type EntityAnswer = { kind?: "EVENT"; label?: string; placeId?: string; googlePlaceId?: string; city?: string; address?: string;
  subtype?: string; date?: string; endDate?: string };
/** Composite answer reducer delegates invalidation to Builder, and never estimates finances in React. */
export function applyProjectAnswer(state: BuilderState, id: QuestionId, answer: WizardAnswer, env: WizardEnvironment): BuilderState {
  const c = state.draft.context, p = c.project ?? { version: 2 as const }, intent = intentForDraft(state.draft);
  const patch = (part: Partial<PlannedExpenseContext>, project?: Partial<PlannedProjectContext>) => {
    const context = { ...c, ...part, project: { ...p, ...project } };
    const next = changeBuilderContext(state, context);
    return { ...next, draft: editBuilderDraft(state, next.draft).draft };
  };
  if (id === "participants" || id === "workPerson") {
    const value = typeof answer === "object" && answer ? answer : { personIds: answer === "BOTH" || answer === "GROUP" ? env.persons.map(p => p.personId) : [answer] };
    const ids = (value.personIds as string[]) ?? [];
    const count = Number(value.count ?? ids.length), mode = answer === "GROUP" || value.group ? "GROUP" : ids.length === 1 ? "SOLO" : "COUPLE";
    return patch({ participantPersonIds: ids, companionMode: mode, additionalGuestCount: Number(value.guests ?? 0) || undefined },
      { financialScope: { personIds: ids, count: Math.max(1, count) } });
  }
  if (id === "socialParticipants") {
    const value = answer as { personIds: string[]; contactKeys: string[]; guests: number };
    const ids = value.personIds.filter(id => env.persons.some(p => p.personId === id));
    const refs: ProspectivePersonRef[] = value.contactKeys.map(contactKey => ({ kind: "CONTACT", contactKey }));
    return patch({ participantPersonIds: ids, participantRefs: refs, additionalGuestCount: value.guests || undefined },
      { financialScope: { personIds: ids, count: Math.max(1, ids.length) } });
  }
  if (id === "groupScope") {
    const value = answer as { count: number; guests: number };
    return patch({ additionalGuestCount: value.guests }, { financialScope: { personIds: c.participantPersonIds ?? [], count: value.count } });
  }
  if (id === "channel") {
    const mode = answer === "DELIVERY" ? intent === "purchase" ? "ONLINE" : "DELIVERY" : answer === "PICKUP" ? "TAKEAWAY" : answer === "UNDECIDED" ? undefined : "IN_STORE";
    return patch({ purchaseMode: mode }, { channel: answer as PlannedProjectContext["channel"] });
  }
  if (id === "workMode") return patch({ workMealMode: answer as PlannedExpenseContext["workMealMode"], purchaseMode: answer === "DELIVERED" ? "DELIVERY" : undefined });
  if (id === "groceriesNature") return patch({ groceriesNature: answer as PlannedExpenseContext["groceriesNature"] });
  if (id === "tripKind") return patch({}, { tripKind: answer as PlannedProjectContext["tripKind"] });
  if (id === "partyKind") {
    const subtype = answer === "EVENT" ? "club_festival" : String(answer);
    const next = state.draft.subtypeKey === subtype ? state : changeProjectSubtype(state, subtype);
    return changeBuilderContext(next, { ...next.draft.context, eventName: answer === "EVENT" ? next.draft.context.eventName : undefined, outingKind: subtype === "club_festival" ? answer === "EVENT" ? "EVENT" : "CLUB" : undefined });
  }
  if (id === "contact" || id === "host") {
    if (answer === "OWN_HOME") return patch({ housePartyPlaceMode: "OWN_HOME", host: undefined });
    const ref = typeof answer === "string" ? { kind: "CONTACT" as const, contactKey: answer } : answer as ProspectivePersonRef;
    const contact = ref.kind === "CONTACT" ? SOCIAL_CONTACTS_V1.find(p => p.key === ref.contactKey) : undefined;
    let next = patch(id === "host" ? { housePartyPlaceMode: "OTHER_HOME", host: ref } : { personVisited: ref });
    if (id === "contact") {
      const subtypeKey = contact?.kind === "FAMILY" ? "family_visit" : "friend_visit", root = rootAssetModule("visit_trip", subtypeKey);
      next = { ...next, draft: { ...next.draft, subtypeKey, costItems: next.draft.costItems.map(item => ({ ...item, modulePath: item.modulePath?.[1] ? [root, item.modulePath[1]] : [root] })) } };
    }
    const home = contact?.places.find(p => p.relation === "HOME");
    if (home) next = { ...next, origins: { ...next.origins, place: "AUTO_DERIVED" }, draft: { ...next.draft, context: { ...next.draft.context,
      place: home.placeId ? { kind: "KNOWN", placeId: home.placeId } : { kind: "TEXT", label: home.textPlace!, provenance: "USER_DECLARED_PROSPECTIVE" } } } };
    return next;
  }
  if (id === "format") return intent === "groceries" ? patch({}, { mealFormat: ({ SIMPLE: "TWO", APERO_PARTY: "APERO", MEAL: "MEAL", STAY: "GROUP" } as const)[answer as "SIMPLE" | "APERO_PARTY" | "MEAL" | "STAY"] }) : patch({ visitFormat: answer as PlannedExpenseContext["visitFormat"] });
  if (id === "groceryFocus") return patch({}, { groceryFocus: answer as PlannedProjectContext["groceryFocus"] });
  if (id === "automotiveKind") return patch({}, { automotiveKind: answer as PlannedProjectContext["automotiveKind"] });
  if (id === "occasion") {
    if (typeof answer === "object" && answer) return patch({ socialOccasion: "OTHER_SPECIAL", occasionLabel: String(answer.label) });
    const valentine = answer === "VALENTINE", reunion = answer === "REUNION";
    return patch({ socialOccasion: valentine || reunion ? "OTHER_SPECIAL" : answer as PlannedExpenseContext["socialOccasion"],
      occasionLabel: valentine ? "Saint-Valentin" : reunion ? "Retrouvailles" : undefined });
  }
  if (id === "date") {
    const value = typeof answer === "object" && answer ? answer : { date: answer };
    const date = value.date as string | null, endDate = value.endDate as string | undefined;
    const moment = date ? (value.moment ?? p.moment ?? "NONE") as PlannedProjectContext["moment"] : undefined;
    const exactTime = moment === "EXACT" ? (value.exactTime ?? p.exactTime) as string | undefined : undefined;
    const returnMoment = endDate ? (value.returnMoment ?? "NONE") as PlannedProjectContext["returnMoment"] : undefined;
    const returnExactTime = returnMoment === "EXACT" ? value.returnExactTime as string | undefined : undefined;
    return editBuilderDraft(state, { ...state.draft, plannedDate: date, context: { ...c, endDate,
      visitTiming: intent === "visit" && date && c.personVisited && c.place ? { outbound: { date, time: exactTime ?? null },
        return: { required: true, date: endDate ?? date, time: returnExactTime ?? null } } : undefined,
      ...(c.restaurant ? { restaurant: { ...c.restaurant, plannedTime: exactTime ?? null,
        timeBucket: moment === "MORNING" || moment === "LUNCH" || moment === "EVENING" ? moment : undefined } } : {}),
      ...(c.route ? { route: { ...c.route, plannedTime: exactTime ?? null } } : {}),
      project: { ...p, moment, exactTime, returnMoment, returnExactTime } } });
  }
  if (id === "moment") {
    const value = typeof answer === "object" && answer ? answer : { moment: answer };
    const moment = value.moment as PlannedProjectContext["moment"], time = value.exactTime as string | undefined;
    return patch({ ...(c.route ? { route: { ...c.route, plannedTime: time ?? null } } : {}), ...(c.visitTiming ? { visitTiming: { ...c.visitTiming, outbound: { ...c.visitTiming.outbound, time: time ?? null } } } : {}),
      ...(intent === "restaurant" ? { restaurant: { ...c.restaurant, plannedTime: time ?? null,
      timeBucket: moment === "MORNING" || moment === "LUNCH" || moment === "EVENING" ? moment : undefined } } : {}) }, { moment, exactTime: time });
  }
  if (id === "entity") {
    if (answer === "LATER") return patch({ place: undefined, seller: undefined, purchaseDescription: undefined, eventName: undefined,
      ...(c.restaurant ? { restaurant: { ...c.restaurant, restaurantName: undefined, city: undefined, googlePlaceId: undefined, address: undefined } } : {}) }, { entity: undefined });
    const v = answer as EntityAnswer;
    const kind = intent === "purchase" ? "PRODUCT" : intent === "groceries" || delivery({ draft: state.draft, env, session: emptyWizardSession(), intent }) ? "SELLER"
      : intent === "trip" ? "DESTINATION" : c.outingKind === "EVENT" || intent === "activity" && v.kind === "EVENT" ? "EVENT" : "VENUE";
    const place = v.placeId ? { kind: "KNOWN" as const, placeId: v.placeId } : kind === "VENUE" || kind === "DESTINATION" || kind === "EVENT"
      ? { kind: "TEXT" as const, label: v.address && !v.googlePlaceId ? `${v.label} · ${v.address}`.slice(0, 120) : v.label!, provenance: "USER_DECLARED_PROSPECTIVE" as const } : undefined;
    const policy = resolved({ draft: state.draft, env, intent, session: emptyWizardSession() });
    let next = patch({ ...(place && policy.fields.place !== "HIDDEN" ? { place } : {}), ...(kind !== "PRODUCT" && policy.fields.seller !== "HIDDEN" ? { seller: v.label } : {}),
      ...(intent === "restaurant" ? { restaurant: { ...c.restaurant, restaurantName: v.label, city: v.city,
        googlePlaceId: v.googlePlaceId, address: v.googlePlaceId ? undefined : v.address } } : {}),
      ...(intent === "purchase" ? { purchaseDescription: v.label } : {}), ...(kind === "EVENT" ? { eventName: v.label } : {}) },
      { entity: { kind, label: v.label!, ...(kind !== "SELLER" && kind !== "PRODUCT" && v.googlePlaceId ? { googlePlaceId: v.googlePlaceId } : {}), city: v.city,
        ...(v.googlePlaceId ? {} : { address: v.address }) } });
    if (v.subtype && v.subtype !== next.draft.subtypeKey) next = changeProjectSubtype(next, v.subtype);
    if (v.date) next = editBuilderDraft(next, { ...next.draft, plannedDate: v.date, context: { ...next.draft.context, endDate: v.endDate } });
    return next;
  }
  if (id === "provider") {
    const v = answer as { key: string; label: string }; return patch({ deliveryProviderKey: v.key, deliveryProvider: v.label });
  }
  if (id === "seller") {
    if (answer === "LATER") return patch({ seller: undefined, place: undefined }, { sellerGooglePlaceId: undefined });
    const v = answer as EntityAnswer, policy = resolved({ draft: state.draft, env, intent, session: emptyWizardSession() });
    const place = policy.fields.place === "HIDDEN" ? undefined : v.placeId ? { kind: "KNOWN" as const, placeId: v.placeId }
      : v.address || v.googlePlaceId ? { kind: "TEXT" as const, label: v.googlePlaceId ? v.label! : `${v.label} · ${v.address}`.slice(0, 120), provenance: "USER_DECLARED_PROSPECTIVE" as const } : undefined;
    return patch({ seller: v.label, place }, { sellerGooglePlaceId: v.googlePlaceId });
  }
  if (id === "giftRecipient") return patch({ gift: answer as PlannedExpenseContext["gift"] });
  if (id === "lodging") {
    const next = patch({}, { lodging: answer as PlannedProjectContext["lodging"],
      unpricedComponents: answer === "RELATIVE" ? (p.unpricedComponents ?? []).filter(v => v !== "Hébergement") : [...new Set([...(p.unpricedComponents ?? []), "Hébergement"])] });
    if (answer === p.lodging) return next;
    const removed = state.draft.costItems.filter(i => projectCostComponent(i) === "Hébergement");
    return { ...next, undo: structuredClone({ ...state, undo: null }), draft: { ...next.draft, costItems: next.draft.costItems.filter(i => !removed.some(old => old.id === i.id)) },
      suspended: [...next.suspended, ...removed.map(i => ({ path: `cost.${i.id}`, value: i, origin: "EXPLICIT" as const, reason: "Le choix d’hébergement a changé ; le montant précédent reste récupérable." }))] };
  }
  if (id === "transport") { const next = patch({ transportMode: answer === "LATER" ? undefined : answer as PlannedExpenseContext["transportMode"] },
    { unpricedComponents: answer === "LATER" ? [...new Set([...(p.unpricedComponents ?? []), "Transport"])] : (p.unpricedComponents ?? []).filter(v => v !== "Transport") }); return answer === "CAR" ? startProjectCar(next, env.places) : next; }
  if (id === "visitReturn") {
    const value = answer as { date: string; time?: string };
    return patch({ visitTiming: { outbound: { date: state.draft.plannedDate, time: p.exactTime ?? null },
      return: { required: true, date: value.date, time: value.time ?? null } } });
  }
  if (id === "costMode") {
    let next = patch({ noExpense: answer === "FREE" ? true : undefined, ...(intent === "restaurant" ? { restaurant: { ...c.restaurant, priceBasis: answer === "DETAIL" ? "DETAILED" : answer === "TOTAL" ? "KNOWN" : undefined } } : {}) },
      { unpricedComponents: answer === "LATER" ? [...new Set([...(p.unpricedComponents ?? []), "Budget principal"])] : (p.unpricedComponents ?? []).filter(v => v !== "Budget principal") });
    if (answer === "DETAIL") next = itemizeBuilderCosts(next);
    const principalCost = (i: PlannedExpenseDraft["costItems"][number]) => i.modulePath?.length !== 2 && plannedAsset(i.assetKey ?? "")?.module !== "transport" && projectCostComponent(i) !== "Hébergement";
    if (["LATER", "TOTAL", "FREE"].includes(String(answer)) && (state.quickTotal && answer !== "TOTAL" || state.draft.costItems.some(principalCost))) {
      const previous = structuredClone({ ...state, undo: null });
      const removed = next.draft.costItems.filter(principalCost);
      next = { ...next, quickTotal: "", undo: previous, draft: { ...next.draft, costItems: next.draft.costItems.filter(i => !removed.includes(i)) }, suspended: [...next.suspended,
        ...removed.map(i => ({ path: `cost.${i.id}`, value: i, origin: "EXPLICIT" as const, reason: "Ce budget est remplacé par votre nouveau choix." })),
        ...(state.quickTotal ? [{ path: "quickTotal", value: state.quickTotal, origin: "EXPLICIT" as const, reason: "Le total précédent est conservé hors du calcul." }] : [])] };
    }
    return next;
  }
  if (id === "costTotal") return setQuickTotal(state, String(answer));
  if (id === "link") {
    if (answer === "NONE") return patch({}, { linkedProjectId: undefined, shareTransport: undefined });
    const parent = env.linkedProjects?.find(p => p.id === answer);
    if (!parent) throw new TypeError("PLANNED_PROJECT_LINK_INVALID");
    const next = patch({ participantPersonIds: parent.draft.context.participantPersonIds ?? c.participantPersonIds },
      { linkedProjectId: parent.id, financialScope: parent.draft.context.project?.financialScope ?? p.financialScope,
        shareTransport: !!parent.draft.context.route || !!parent.draft.context.transportMode || parent.draft.context.housePartyPlaceMode === "OWN_HOME" });
    return editBuilderDraft(next, { ...next.draft, plannedDate: parent.draft.plannedDate ?? next.draft.plannedDate });
  }
  return state;
}

/** Changing an intent subtype keeps unrelated answers and suspends incompatible economic lines. */
export function changeProjectSubtype(state: BuilderState, subtypeKey: string): BuilderState {
  const root = rootAssetModule(state.draft.familyKey, subtypeKey), oldRoot = rootAssetModule(state.draft.familyKey, state.draft.subtypeKey);
  if (root === oldRoot) return editBuilderDraft(state, { ...state.draft, subtypeKey });
  const retained = state.draft.costItems.filter(i => !i.assetKey || plannedAsset(i.assetKey)?.module === root || plannedAsset(i.assetKey)?.module === "transport");
  const removed = state.draft.costItems.filter(i => !retained.includes(i));
  const before = structuredClone({ ...state, undo: null });
  const context = { ...state.draft.context, project: state.draft.context.project ? { ...state.draft.context.project,
    automotiveKind: subtypeKey === "automotive" ? state.draft.context.project.automotiveKind : undefined } : undefined,
    housePartyPlaceMode: subtypeKey === "house_party" ? state.draft.context.housePartyPlaceMode : undefined,
    eventName: subtypeKey === "club_festival" ? state.draft.context.eventName : undefined,
    outingKind: subtypeKey === "club_festival" ? state.draft.context.outingKind : undefined,
    childLocalPlaceRefs: undefined, route: undefined, place: undefined, transportMode: undefined };
  const next = changeBuilderContext({ ...state, draft: { ...state.draft, subtypeKey, costItems: retained.map(i => ({ ...i, modulePath: [root] })) } }, context);
  return { ...next, undo: before, acceptedChildren: [], suspended: [...next.suspended,
    ...(state.draft.context.place ? [{ path: "place", value: state.draft.context.place, origin: "EXPLICIT" as const, reason: "Le lieu du projet précédent est conservé pour annuler le changement." }] : []),
    ...removed.map(i => ({ path: `cost.${i.id}`,
    value: structuredClone(i), origin: "EXPLICIT" as const, reason: "Cet élément ne correspond plus au nouveau projet." }))] };
}

export function startProjectCar(state: BuilderState, places: readonly PlannedPlaceOption[]): BuilderState {
  const home = places.find(p => derivePlannedPlaceRoles(p).includes("OWN_HOME")), ref = state.draft.context.place;
  if (!home || !ref) return state;
  const label = ref.kind === "TEXT" ? ref.label : places.find(p => p.placeId === ref.placeId)?.name ?? "Destination";
  const departure = { placeId: home.placeId, label: home.name, endpointSource: "DIRECT_PLACE" as const };
  const stops = ensurePrimaryRouteStop(state.draft.context.route?.stops ?? [departure, stopForPlace(ref, label, "ROOT_PLACE"), departure], ref, label, home.placeId);
  return editBuilderDraft(state, { ...state.draft, context: { ...state.draft.context, transportMode: "CAR",
    route: { ...state.draft.context.route, mode: "CAR", stops, plannedTime: state.draft.context.project?.exactTime ?? null, timeKind: "DEPARTURE" } } });
}

/** An explicit unknown transport price never becomes a zero-price ticket or toll. */
export function deferProjectTransportPrice(state: BuilderState, component: "Transport" | "Péages"): BuilderState {
  const removed = state.draft.costItems.filter(i => component === "Péages" ? i.assetKey === "transport:toll"
    : plannedAsset(i.assetKey ?? "")?.module === "transport" && i.assetKey !== "transport:fuel_usage");
  const next = changeBuilderContext(state, { ...state.draft.context, project: { ...state.draft.context.project!,
    unpricedComponents: [...new Set([...(state.draft.context.project?.unpricedComponents ?? []), component])] } });
  return { ...next, undo: structuredClone({ ...state, undo: null }), draft: { ...next.draft, costItems: next.draft.costItems.filter(i => !removed.some(old => old.id === i.id)) },
    suspended: [...next.suspended, ...removed.map(i => ({ path: `cost.${i.id}`, value: i, origin: "EXPLICIT" as const, reason: "Ce montant est désormais à préciser." }))] };
}

export function projectHasSignificantDraft(state: BuilderState, session: WizardSession) {
  return state.draft.costItems.length > 0 || !!state.quickTotal || session.history.some(id => !["partyKind", "tripKind"].includes(id));
}
