"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Big from "big.js";
import { CalendarDays, Plus, RotateCcw, Trash2 } from "lucide-react";
import { PLANNED_FAMILIES, PLANNED_SUBTYPE_LABELS, assetsForModule, plannedAsset, rootAssetModule, suggestedAssetQuantity,
  type AssetModule, type PlannedAsset, type PlannedExpenseFamily } from "@/domain/phase2/planned-assets";
import { plannedLineGross } from "@/domain/phase2/planned-money";
import { rankPlacesForPlannedContext, type PlannedPlaceOption } from "@/domain/phase2/planned-places";
import { DELIVERY_PROVIDERS, SOCIAL_CONTACTS_V1, baselineKeyForModule,
  resolvePlannedContext } from "@/domain/phase2/planned-rules";
import { acceptBuilderChild, availableBuilderChildren, changeBuilderContext, changeBuilderRoot, collapseBuilderCosts, createBuilderState,
  builderIssuesForStep, replaceBuilderAggregate, deriveBuilderReadiness, discardSuspended, editBuilderDraft, itemizeBuilderCosts, materializeBuilderDraft,
  setQuickBaseline, setQuickTotal, splitRestaurantQuickTotal, suggestedBuilderChildren,
  undoBuilderChange } from "@/domain/phase2/planned-builder";
import type { CostItem, ModulePath, PlannedBaselineKey, PlannedExpenseContext, PlannedPriceSuggestion, PlannedVehicleEstimate } from "@/domain/phase2/planned-contract";
import type { PlannedExpenseCard } from "./planned-expenses-projection";
import { confirmPlannedExpenseReality, restorePlannedExpenseAction, reportPlannedExpenseAction,
  previewPlannedExpense, removePlannedExpense, savePlannedExpense } from "./planned-expenses-actions";
import { canCollapseRealityCosts, fundingAfterGrossChange, type PlannedIssue, type PlannedResult, type RealityConfirmationDraft } from "@/domain/phase2/planned-mutations";

import { PLANNED_INTENTS, assetParticipantCount, baselineQuestion, builderAssetChoices, costAllowsBaseline, isRootCost, plannedParticipantCount } from "@/domain/phase2/planned-product";
import { PlannedContactField, PlannedParticipants } from "./planned-people-fields";
import { PlannedRouteEditor } from "./planned-route-editor";
import { PlannedImpactCard } from "./planned-impact-card";
import { usePlannedExpenseInteractions } from "./planned-expense-interactions";
import { calendarExpenseActions } from "./calendar-presentation";

type Person = { personId: string; displayName: string };
type Draft = Pick<PlannedExpenseCard, "familyKey" | "subtypeKey" | "title" | "plannedDate" | "costItems" | "context">;
type Preview = Extract<Awaited<ReturnType<typeof previewPlannedExpense>>, { ok: true }>["value"];
type Funding = NonNullable<Preview["funding"]>;
type Props = { targetMonth: string; expenses: readonly PlannedExpenseCard[]; persons: readonly Person[];
  places: readonly PlannedPlaceOption[]; vehicle: PlannedVehicleEstimate | null;
  prices: readonly PlannedPriceSuggestion[]; funding: Funding };

const money = (value: string) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR",
  minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
const dateLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" })
  .format(new Date(`${value}T12:00Z`));
const monthEnd = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
const inputClass = "min-h-11 min-w-0 w-full rounded-xl border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-emerald-700";
const secondary = "min-h-10 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-700";
const primary = "min-h-11 rounded-xl bg-emerald-800 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-900 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-emerald-700";
const visitedFamily = SOCIAL_CONTACTS_V1.filter((contact) => contact.kind === "FAMILY");
const visitedFriends = SOCIAL_CONTACTS_V1.filter((contact) => contact.kind === "FRIEND");

const emptyDraft = (): Draft => ({ familyKey: "outing", subtypeKey: null, title: "", plannedDate: null,
  costItems: [], context: {} });
const familyLabel = (family: PlannedExpenseFamily) => PLANNED_FAMILIES.find((part) => part.key === family)?.label ?? "Projet";
const subtypeLabel = (family: PlannedExpenseFamily, subtype: string | null) =>
  PLANNED_SUBTYPE_LABELS[family].find((part) => part.key === subtype)?.label ?? "";
const moduleLabel = (module: AssetModule): string => ({ restaurant: "Restaurant", gift: "Cadeau",
  transport: "Transport", house_party: "Soirée", visit_family: "Visite famille", visit_friend: "Visite amis",
  groceries: "Courses", fast_food: "Fast-food", work_meal: "Repas au travail", activity: "Activité",
  beauty: "Beauté", clothing: "Vêtements", household: "Produits ménagers", home: "Maison",
  tech: "Matériel", automotive: "Automobile", club: "Club / festival", bar: "Bar", trip: "Séjour",
  fishing: "Pêche", other: "Autre" })[module];
const itemTotal = (item: CostItem) => /^(?:0|[1-9]\d{0,3})(?:\.\d{1,3})?$/u.test(item.quantity)
  && /^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/u.test(item.unitAmount)
  && new Big(item.quantity).gt(0) && new Big(item.unitAmount).gt(0)
  && new Big(plannedLineGross(item)).gte("0.01") ? plannedLineGross(item) : null;
const fundingMode = (item: CostItem): "BANK" | "SWILE" | "EDENRED" | "MIXED" =>
  !item.fundingAllocations?.length ? "BANK" : item.fundingAllocations.length === 1
    ? item.fundingAllocations[0]!.source : "MIXED";
const baselineFor = (module: AssetModule, personIds: readonly string[], people: readonly Person[]): PlannedBaselineKey | null => {
  const name = people.find((person) => person.personId === personIds[0])?.displayName;
  return baselineKeyForModule(module, name === "Adrien" ? "ADRIEN" : name === "Manon" ? "MANON" : undefined);
};
function unwrap<T>(result: PlannedResult<T>): T {
  if (!result.ok) throw Object.assign(new Error(result.issue.message), { issue: result.issue });
  return result.value;
}

export function PlannedExpensesControl({ targetMonth, expenses, persons, places, vehicle, prices, funding }: Props) {
  const router = useRouter();
  const interactions = usePlannedExpenseInteractions();
  const [open, setOpen] = useState(false);
  const [simulationMode, setSimulationMode] = useState(false);
  const [step, setStep] = useState(1);
  const [intentChoices, setIntentChoices] = useState<readonly string[] | undefined>();
  const [assetLens, setAssetLens] = useState<"MODULE" | "BRING_ITEMS">("MODULE");
  const [intentFamily, setIntentFamily] = useState<PlannedExpenseFamily>("outing");
  const [closeRequested, setCloseRequested] = useState(false);
  const [builder, setBuilder] = useState(() => createBuilderState(emptyDraft()));
  const draft = builder.draft;
  const setDraft = (next: Draft | ((current: Draft) => Draft)) => setBuilder((current) => {
    const updated = typeof next === "function" ? next(current.draft) : next;
    return editBuilderDraft({ ...current, origins: { ...current.origins,
      ...(JSON.stringify(updated.context.gift) !== JSON.stringify(current.draft.context.gift) ? { gift: "EXPLICIT" as const } : {}),
      ...(JSON.stringify(updated.context.place) !== JSON.stringify(current.draft.context.place) ? { place: "EXPLICIT" as const } : {}),
      ...(JSON.stringify(updated.context.route) !== JSON.stringify(current.draft.context.route) ? { route: "EXPLICIT" as const } : {}),
    } }, updated);
  });
  const [modulePath, setModulePath] = useState<AssetModule[]>([]);
  const [search, setSearch] = useState("");
  const [editedId, setEditedId] = useState<string | undefined>();
  const [requestId, setRequestId] = useState("");
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState<string | undefined>();
  const [realityMode, setRealityMode] = useState<"DECLARE" | "CORRECT" | null>(null);
  const [issue, setIssue] = useState<PlannedIssue | null>(null);
  const [notice, setNotice] = useState("");
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportDate, setReportDate] = useState("");
  const inFlight = useRef(false);
  const draftSession = useRef(0);
  const currentRevision = useRef(builder.revision);
  currentRevision.current = builder.revision;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewRevision, setPreviewRevision] = useState<number | null>(null);
  const [splitMeal, setSplitMeal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const root = rootAssetModule(draft.familyKey, draft.subtypeKey);
  const path = modulePath.length && (modulePath.length === 1 || builder.acceptedChildren.includes(modulePath[1]!))
    ? modulePath : [root];
  const module = path.at(-1)!;
  const planned = expenses.filter((item) => item.status === "PLANNED");
  const realized = expenses.filter((item) => item.status === "DECLARED_REALIZED");
  const isWorkMeal = draft.familyKey === "food" && draft.subtypeKey === "work_meal";
  const visitedRef = draft.context.host ?? draft.context.personVisited;
  const visited = visitedRef?.kind === "TEXT" ? visitedRef.label
    : visitedRef?.kind === "CONTACT"
      ? SOCIAL_CONTACTS_V1.find((contact) => contact.key === visitedRef.contactKey)?.label : undefined;
  const contextPersonLabel = isWorkMeal ? persons.find((person) => person.personId === draft.context.participantPersonIds?.[0])?.displayName : visited;
  const resolved = draft.subtypeKey !== null || draft.familyKey === "other"
    ? resolvePlannedContext({ familyKey: draft.familyKey, subtypeKey: draft.subtypeKey,
      modifiers: { purchaseMode: draft.context.purchaseMode, housePartyPlaceMode: draft.context.housePartyPlaceMode,
        visitFormat: draft.context.visitFormat, socialOccasion: draft.context.socialOccasion,
        deliveryProviderKey: draft.context.deliveryProviderKey,
        workMealPerson: contextPersonLabel === "Adrien" ? "ADRIEN" : contextPersonLabel === "Manon" ? "MANON" : undefined } }) : null;
  const relevantPlaces = resolved ? rankPlacesForPlannedContext(places, resolved, {
    contactKey: visitedRef?.kind === "CONTACT" ? visitedRef.contactKey : undefined,
    workMealPersonName: isWorkMeal ? contextPersonLabel : undefined,
    assetKeys: draft.costItems.flatMap((item) => item.assetKey ? [item.assetKey] : []),
    giftAssetKey: draft.costItems.find((item) => item.assetKey?.startsWith("gift:"))?.assetKey ?? undefined,
  }).map((item) => item.place) : [];
  const supportsParticipants = !!resolved && (resolved.fields.participants !== "HIDDEN" || resolved.fields.travelCompanions !== "HIDDEN");
  const isVisit = draft.familyKey === "visit_trip" && ["family_visit", "friend_visit"].includes(draft.subtypeKey ?? "");
  const readiness = deriveBuilderReadiness(builder, { places, workMealPersonName: isWorkMeal ? contextPersonLabel : undefined });
  const stepIssues = builderIssuesForStep(builder, step, { places, workMealPersonName: isWorkMeal ? contextPersonLabel : undefined });
  const contextValid = builderIssuesForStep(builder, 3, { places, workMealPersonName: isWorkMeal ? contextPersonLabel : undefined }).length === 0;
  const canPreview = readiness.previewReady;
  const previewCurrent = preview !== null && previewRevision === builder.revision && preview.targetMonth === targetMonth;
  const simpleGross = materializeBuilderDraft(builder).costItems.every((item) => itemTotal(item))
    ? materializeBuilderDraft(builder).costItems.reduce((sum, item) => sum.plus(itemTotal(item)!), new Big(0)).toFixed(2) : null;

  const resetPreview = () => { setPreview(null); setError(""); setIssue(null); };
  const start = (item?: PlannedExpenseCard, mode: "DECLARE" | "CORRECT" | null = null, plannedDate?: string) => {
    setSimulationMode(false);
    if (inFlight.current) return;
    draftSession.current++;
    const next = item ? { familyKey: item.familyKey, subtypeKey: item.subtypeKey, title: item.title,
      plannedDate: item.plannedDate, costItems: item.costItems.map((cost) => ({ ...cost })), context: { ...item.context } } : { ...emptyDraft(), plannedDate: plannedDate ?? null };
    setBuilder(createBuilderState(next)); setSplitMeal(""); setAssetLens("MODULE"); setIntentChoices(undefined);
    setRequestId(item?.id ?? crypto.randomUUID()); setExpectedUpdatedAt(item?.updatedAt); setRealityMode(mode);
    setIssue(null); setNotice(""); setReportId(null); setDeleteId(null);
    setIntentFamily(next.familyKey); setCloseRequested(false);
    setModulePath([rootAssetModule(next.familyKey, next.subtypeKey)]);
    setEditedId(item?.id); setPreview(null); setPreviewRevision(null); setError(""); setSearch(""); setStep(item ? 3 : 1); setOpen(true);
    window.setTimeout(() => { const target = document.getElementById("planned-expense-builder"); target?.scrollIntoView({ behavior: "smooth" }); target?.focus(); }, 0);
  };
  const updateItem = (id: string, change: Partial<CostItem>) => {
    setBuilder((state) => editBuilderDraft({ ...state, origins: {
      ...state.origins,
      ...(change.baselineKey !== undefined ? { [`baseline.${id}`]: "EXPLICIT" as const } : {}),
      ...(change.quantity !== undefined ? { [`quantity.${id}`]: "EXPLICIT" as const } : {}),
      ...(change.unitAmount !== undefined ? { [`price.${id}`]: "EXPLICIT" as const } : {}),
    } },
      { ...state.draft, costItems: state.draft.costItems.map((item) => item.id !== id ? item : (() => {
      const next = { ...item, ...change };
      if ((change.quantity !== undefined || change.unitAmount !== undefined) && item.fundingAllocations?.length === 1) {
        const total = itemTotal(next);
        if (total) next.fundingAllocations = fundingAfterGrossChange(item, total);
      }
      return next;
    })()) }));
    resetPreview();
  };
  const addAsset = (asset?: PlannedAsset) => {
    const knownPrice = asset ? prices.find((price) => price.assetKey === asset.assetKey) : undefined;
    const quantity = asset ? suggestedAssetQuantity(asset, assetParticipantCount(asset, draft.context)) : "1";
    const itemPath: ModulePath = path.length === 2 ? [root, module] : [root];
    const item: CostItem = { id: crypto.randomUUID(), assetKey: asset?.assetKey ?? null, label: asset?.label ?? "",
      quantity, unitAmount: knownPrice?.unitAmount ?? asset?.defaultUnitAmount ?? "", baselineKey: null, modulePath: itemPath,
      priceSource: knownPrice ? "LAST_KNOWN" : asset?.defaultUnitAmount ? "SYSTEM_DEFAULT" : "MANUAL",
      ...(knownPrice || asset?.defaultUnitAmount ? { priceSourceLabel: knownPrice?.sourceLabel ?? "Prix proposé, modifiable" } : {}) };
    setBuilder((current) => {
      if (asset && current.draft.costItems.some((old) => old.assetKey === asset.assetKey && JSON.stringify(old.modulePath) === JSON.stringify(item.modulePath))) return current;
      const prepared = { ...current, origins: { ...current.origins,
        [`quantity.${item.id}`]: asset ? "AUTO_DERIVED" as const : "EXPLICIT" as const,
        [`price.${item.id}`]: knownPrice || asset?.defaultUnitAmount ? "AUTO_DERIVED" as const : "EXPLICIT" as const,
        [`cost.${item.id}`]: "EXPLICIT" as const } };
      return replaceBuilderAggregate(prepared, item);
    });
    resetPreview();
  };
  const setFunding = (item: CostItem, mode: "BANK" | "SWILE" | "EDENRED" | "MIXED") => {
    const total = itemTotal(item);
    if (mode === "BANK") return updateItem(item.id, { fundingAllocations: undefined });
    if (!total) return;
    if (mode === "MIXED") {
      return updateItem(item.id, { fundingAllocations: [{ source: "BANK", amount: "" }, { source: "SWILE", amount: "" }] });
    }
    updateItem(item.id, { fundingAllocations: [{ source: mode, amount: total }] });
  };
  const editAllocation = (item: CostItem, source: "BANK" | "SWILE" | "EDENRED", amount: string) => {
    const next = [...(item.fundingAllocations ?? [])];
    const index = next.findIndex((part) => part.source === source);
    if (index >= 0) next[index] = { source, amount };
    else if (amount !== "" && Number(amount) > 0) next.push({ source, amount });
    updateItem(item.id, { fundingAllocations: next.filter((part) => part.amount === "" || Number(part.amount) > 0) });
  };
  const setPerson = (person: Person) => {
    const current = draft.context.participantPersonIds ?? [];
    const ids = isWorkMeal ? [person.personId] : current.includes(person.personId)
      ? current.filter((id) => id !== person.personId) : [...current, person.personId];
    setBuilder((state) => {
      const contextual = changeBuilderContext(state, { ...state.draft.context, participantPersonIds: ids });
      return editBuilderDraft({ ...contextual, quickBaseline: isWorkMeal && state.quickBaseline
        ? baselineFor("work_meal", ids, persons) : state.quickBaseline }, { ...contextual.draft,
      costItems: contextual.draft.costItems.map((item) => {
        const asset = item.assetKey ? assetsForModule(item.modulePath?.at(-1) ?? root).find((part) => part.assetKey === item.assetKey) : undefined;
        const quantity = asset && state.origins[`quantity.${item.id}`] === "AUTO_DERIVED"
          ? suggestedAssetQuantity(asset, plannedParticipantCount({ ...state.draft.context, participantPersonIds: ids })) : item.quantity;
        const next = { ...item, quantity,
          baselineKey: item.baselineKey?.endsWith("-work-meals") ? baselineFor("work_meal", ids, persons) : item.baselineKey };
        return item.fundingAllocations?.length === 1 && quantity !== item.quantity && itemTotal(next)
          ? { ...next, fundingAllocations: fundingAfterGrossChange(item, itemTotal(next)!) } : next;
      }) });
    });
    resetPreview();
  };
  const selectSubtype = (family: PlannedExpenseFamily, subtype: string | null) => {
    if (family === draft.familyKey && subtype === draft.subtypeKey && draft.title) { setStep(3); return; }
    const label = subtypeLabel(family, subtype) || familyLabel(family);
    setBuilder((current) => changeBuilderRoot(current, { familyKey: family, subtypeKey: subtype,
      title: label, plannedDate: current.draft.plannedDate, costItems: [], context: { participantPersonIds: family !== "other" && subtype !== "work_meal" ? persons.map((person) => person.personId) : undefined } }));
    setSplitMeal(""); setAssetLens("MODULE"); setModulePath([rootAssetModule(family, subtype)]); setStep(3); resetPreview();
  };
  const run = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError("");
    try { await action(); router.refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Impossible d’enregistrer. Réessayez.");
      setIssue((caught as { issue?: PlannedIssue })?.issue ?? null); }
    finally { setBusy(false); inFlight.current = false; }
  };
  const simulate = async () => {
    if (!canPreview || inFlight.current) return;
    inFlight.current = true;
    const revision = builder.revision;
    const session = draftSession.current;
    setBusy(true); setError("");
    try { const value = unwrap(await previewPlannedExpense(targetMonth, materializeBuilderDraft(builder, true), editedId));
      if (currentRevision.current !== revision || draftSession.current !== session) return;
      setPreview(value); setPreviewRevision(revision); setStep(5); }
    catch (caught) { if (currentRevision.current === revision && draftSession.current === session) {
      setError(caught instanceof Error ? caught.message : "La simulation n’a pas abouti.");
      setIssue((caught as { issue?: PlannedIssue })?.issue ?? null); } }
    finally { setBusy(false); inFlight.current = false; }
  };
  const save = () => run(async () => {
    if (!readiness.saveReady || !previewCurrent) return;
    const command = { id: requestId, expectedUpdatedAt };
    if (realityMode) {
      const realityDraft: RealityConfirmationDraft = { expenseId: requestId, expectedUpdatedAt: expectedUpdatedAt!,
        finalDraft: materializeBuilderDraft(builder) };
      unwrap(await confirmPlannedExpenseReality(targetMonth, realityDraft.finalDraft,
        { id: realityDraft.expenseId, expectedUpdatedAt: realityDraft.expectedUpdatedAt }, realityMode === "CORRECT"));
      setNotice(realityMode === "CORRECT" ? "Déclaration corrigée." : "Réalisation déclarée. Le financement prévu devient utilisé déclaré.");
    } else {
      const saved = unwrap(await savePlannedExpense(targetMonth, materializeBuilderDraft(builder), command));
      setNotice(saved.notice);
    }
    setOpen(false); setPreview(null); setEditedId(undefined);
  });
  const repairServerIssue = () => {
    if (!issue) return;
    if (issue.repairTarget === "reload") { router.refresh(); return; }
    const step = issue.repairTarget === "context" || issue.repairTarget === "date" ? 3 : 4;
    setStep(step);
    window.setTimeout(() => {
      const fundingTarget = readiness.issues.find((problem) => problem.code === "FUNDING_INCOMPLETE")?.repairTarget;
      const target = issue.repairTarget === "funding"
        ? fundingTarget ? document.getElementById(fundingTarget) : document.querySelector<HTMLElement>('[id^="funding-"]')
        : issue.repairTarget === "route" ? document.getElementById("builder-route")
          : document.getElementById(step === 3 ? "builder-context" : "builder-cost");
      target?.querySelectorAll("details").forEach((details) => { details.open = true; });
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.querySelector<HTMLInputElement>("input, select, button")?.focus();
    }, 0);
  };
  const visibleAssets = (resolved ? builderAssetChoices(resolved, module, draft.context, assetLens) : [])
    .filter((asset) => !search || asset.label.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr")));


  useEffect(() => {
    const pending = interactions?.pending;
    if (!pending) return;
    interactions.consume();
    if (pending.action === "CREATE" || pending.action === "SIMULATE") {
      if (inFlight.current || open && builder.revision > 0) {
        setError("Terminez ou fermez le brouillon ouvert avant de prévoir autre chose.");
        window.setTimeout(() => { const target = document.getElementById("planned-expense-builder"); target?.scrollIntoView({ block: "start" }); target?.focus(); }, 0);
      }
      else {
        start(undefined, null, pending.action === "CREATE" ? pending.plannedDate : undefined);
        setSimulationMode(pending.action === "SIMULATE");
        window.setTimeout(() => { const target = document.getElementById("planned-expense-builder"); target?.scrollIntoView({ block: "start" }); target?.focus(); }, 0);
      }
      return;
    }
    const item = expenses.find((row) => row.id === pending.id);
    if (!item) { setError("Ce projet n’est plus présent. Actualisez la page."); return; }
    if (inFlight.current || open && builder.revision > 0) {
      setError("Terminez ou fermez le brouillon ouvert avant de poursuivre cette action.");
    } else if (pending.action === "RESTORE") {
      void run(async () => { unwrap(await restorePlannedExpenseAction(targetMonth, { id: item.id, expectedUpdatedAt: item.updatedAt })); });
    } else if (pending.action === "REPORT") { setReportId(item.id); setReportDate(item.plannedDate ?? ""); }
    else if (pending.action === "DELETE") setDeleteId(item.id);
    else start(item, pending.action === "DECLARE" ? "DECLARE" : pending.action === "CORRECT" ? "CORRECT" : null);
    window.setTimeout(() => {
      const target = document.getElementById("planned-expense-builder");
      target?.scrollIntoView({ behavior: "smooth", block: "start" }); target?.focus();
    }, 0);
    // Pending is a consumed navigation command, never a second draft authority.
  }, [interactions?.pending]);

  const card = (item: PlannedExpenseCard) => <li key={item.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-xs font-bold text-emerald-900">{familyLabel(item.familyKey)} · {subtypeLabel(item.familyKey, item.subtypeKey)}</p><h4 className="break-words text-base font-black">{item.title}</h4><p className="mt-1 text-xs text-slate-600"><CalendarDays size={13} className="mr-1 inline" aria-hidden="true" />{item.plannedDate ? dateLabel(item.plannedDate) : "Ce mois-ci · sans date précise"}</p></div><strong className="text-lg tabular-nums">{money(item.grossCost)}</strong></div>
    <p className="mt-2 break-words text-xs text-slate-600">{item.costItems.map((cost) => `${cost.variantLabel || cost.label} · ${cost.quantity} × ${money(cost.unitAmount)}`).join(" · ")}</p>
    <p className="mt-2 text-xs font-semibold text-slate-700">{item.status === "PLANNED" ? item.needsRealityConfirmation ? "À confirmer · la date est passée" : "Prévue" : "Réalisée · déclarée par vous"}</p>
    <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">{calendarExpenseActions(item).filter(({ action }) => action !== "DELETE").map(({ action, label }) =>
      <button key={action} type="button" className={secondary} disabled={busy} onClick={() => {
        if (action === "REPORT") { setReportId(item.id); setReportDate(item.plannedDate ?? ""); }
        else if (action === "RESTORE") void run(async () => { unwrap(await restorePlannedExpenseAction(targetMonth, { id: item.id, expectedUpdatedAt: item.updatedAt })); setNotice("Remise en prévu, avec les mêmes coûts."); });
        else start(item, action === "DECLARE" ? "DECLARE" : action === "CORRECT" ? "CORRECT" : null);
      }}>{label}</button>)}
      {deleteId === item.id ? <><span className="self-center text-xs">{item.status === "PLANNED" ? "Confirmer que ce projet n’a pas eu lieu et supprimer sa prévision ?" : "Supprimer définitivement cette déclaration ?"} Son coût et son financement seront retirés du mois.</span><button type="button" className={secondary} disabled={busy} onClick={() => run(async () => { unwrap(await removePlannedExpense(targetMonth, { id: item.id, expectedUpdatedAt: item.updatedAt })); setDeleteId(null); setNotice("Dépense supprimée du mois."); })}>Confirmer la suppression</button><button type="button" className={secondary} onClick={() => setDeleteId(null)}>Annuler</button></>
        : <button type="button" className={secondary} disabled={busy} onClick={() => setDeleteId(item.id)}><Trash2 size={14} className="mr-1 inline" />{calendarExpenseActions(item).find(({ action }) => action === "DELETE")?.label}</button>}
    </div>
    {reportId === item.id && <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3"><label className="grid gap-1 text-sm font-semibold">Nouvelle date prévue<input type="date" className={inputClass} value={reportDate} onChange={(event) => setReportDate(event.target.value)} /></label><p className="text-xs">La même dépense rejoindra le mois choisi. Ses ressources et ses estimations seront revérifiées.</p><div className="flex gap-2"><button className={secondary} disabled={busy || !reportDate} onClick={() => run(async () => { const moved = unwrap(await reportPlannedExpenseAction(targetMonth, { id: item.id, expectedUpdatedAt: item.updatedAt }, reportDate)); setReportId(null); setNotice(`Projet reporté en ${moved.targetMonth}.`); if (moved.targetMonth !== targetMonth) router.push(`/mois-a-venir?month=${moved.targetMonth}`); })}>Confirmer le report</button><button className={secondary} onClick={() => setReportId(null)}>Annuler</button></div></div>}
  </li>;

  return <section id="planned-expense-builder" tabIndex={-1} className="scroll-mt-6 rounded-[1.7rem] bg-sky-50/70 p-5 sm:p-6 focus-visible:outline-2 focus-visible:outline-indigo-700" aria-labelledby="planned-expense-title">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Nos projets</p><h2 id="planned-expense-title" className="text-2xl font-black">Ajouter quelque chose à notre mois</h2><p className="mt-1 text-sm text-slate-600">Un projet, ses éléments, puis son effet sur le mois.</p></div>
      {!open && <button type="button" className={primary} onClick={() => start()}><Plus size={16} className="mr-1 inline" />Prévoir une dépense</button>}</div>
    <datalist id="planned-social-contacts">{SOCIAL_CONTACTS_V1.map((contact) => <option key={contact.key} value={contact.label} />)}</datalist>
    {notice && <p role="status" className="mt-3 rounded-xl bg-emerald-100 p-3 text-sm">{notice}</p>}
    {error && !open && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}{issue?.repairTarget === "reload" && <button className={secondary} onClick={() => router.refresh()}>Recharger la liste</button>}{issue?.repairTarget === "month" && reportDate && <a className="ml-2 underline" href={`/mois-a-venir?month=${reportDate.slice(0, 7)}`}>Préparer les ressources de ce mois</a>}</p>}
    {open && <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">{editedId ? "Modifier" : "Nouvelle prévision"} · {step <= 3 ? "Votre projet" : step === 4 ? "Son coût et ses compléments" : "Aperçu"}</p><h3 className="mt-1 text-lg font-black">{["Qu’avez-vous prévu ?", "Précisons votre idée", "Quelques détails utiles", "Combien prévoyez-vous ?", "Voici l’effet sur notre mois"][step - 1]}</h3></div><div className="flex gap-2">{builder.undo && <button type="button" className={secondary} onClick={() => { setBuilder(undoBuilderChange); setModulePath([]); resetPreview(); }}>Annuler le dernier changement</button>}<button type="button" className={secondary} onClick={() => { if (builder.revision > 0) setCloseRequested(true); else setOpen(false); }}>Fermer</button></div></div>
      {closeRequested && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm"><p>Quitter et abandonner les modifications de ce brouillon ?</p><button type="button" className={secondary} onClick={() => { setOpen(false); setPreview(null); setCloseRequested(false); }}>Abandonner</button><button type="button" className={secondary} onClick={() => setCloseRequested(false)}>Continuer à préparer</button></div>}
      {realityMode && <p className="mt-3 rounded-xl bg-sky-50 p-3 text-sm">{realityMode === "DECLARE" ? "Vérifiez ce qui a réellement coûté et son financement, puis confirmez la réalisation." : "Corrigez les éléments et le financement de votre déclaration."} Pour un coût détaillé, corrigez les lignes ; aucun écart ne sera réparti automatiquement.</p>}
      {error && <div role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800"><p>{error}</p>{issue && <button type="button" className={secondary} onClick={repairServerIssue}>{issue.repairTarget === "reload" ? "Actualiser la liste, garder mon brouillon" : "Aller à la correction"}</button>}{issue?.repairTarget === "reload" && editedId && <button type="button" className={secondary} onClick={() => { const fresh = expenses.find((item) => item.id === editedId); if (fresh) start(fresh, realityMode); }}>Abandonner mon brouillon et reprendre la version affichée</button>}</div>}
      {step >= 3 && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm" aria-live="polite"><strong>Votre projet :</strong> {draft.title || "À nommer"} · {draft.plannedDate ? dateLabel(draft.plannedDate) : "date à préciser si vous le souhaitez"} · {simpleGross && new Big(simpleGross).gt(0) ? money(simpleGross) : "coût à préciser"}{builder.costMode !== "QUICK_TOTAL" && ` · ${draft.costItems.length} élément(s)`}
        <span className="ml-2 font-semibold">{readiness.saveReady ? "Prêt à enregistrer" : readiness.previewReady ? "Aperçu possible" : "À compléter"}</span></div>}
      {step >= 3 && stepIssues.length > 0 && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><strong>À vérifier</strong><ul className="mt-1 list-inside list-disc">{stepIssues.map((issue) => <li key={`${issue.code}-${issue.scope}`}><button type="button" className="text-left underline" onClick={() => { setStep(issue.repairTarget === "builder-cost" || issue.repairTarget.startsWith("funding-") || issue.repairTarget === "builder-addons" ? 4 : 3); window.setTimeout(() => document.getElementById(issue.repairTarget)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0); }}>{issue.message}</button></li>)}</ul></div>}
      {builder.suspended.length > 0 && <div id="builder-suspended" className="mt-3 rounded-xl border border-amber-300 p-3 text-sm"><strong>Informations mises de côté</strong><p>Vos saisies incompatibles sont conservées localement.</p><ul className="list-inside list-disc">{builder.suspended.map((part, index) => <li key={`${part.path}-${index}`}>{part.reason}</li>)}</ul><div className="mt-2 flex gap-2"><button type="button" className={secondary} onClick={() => { setBuilder(undoBuilderChange); setModulePath([]); resetPreview(); }}>Annuler le changement</button><button type="button" className={secondary} onClick={() => setBuilder(discardSuspended)}>Confirmer le retrait</button></div></div>}
      {step === 1 && <div id="builder-intent" className="mt-4 grid grid-cols-3 gap-3">{PLANNED_INTENTS.map((intent) => <button key={intent.label} type="button" className="rounded-xl border border-slate-200 p-4 text-left font-bold hover:border-emerald-700" onClick={() => {
        setIntentChoices(intent.choices);
        if (intent.subtype !== null || intent.family === "other") selectSubtype(intent.family, intent.subtype);
        else { setIntentFamily(intent.family); setStep(2); }
      }}>{intent.label}</button>)}</div>}
      {step === 2 && <div className="mt-4 grid grid-cols-3 gap-2">{PLANNED_SUBTYPE_LABELS[intentFamily].filter((part) => !intentChoices || intentChoices.includes(part.key)).map((part) => <button key={part.key} type="button" className="rounded-xl border border-slate-200 px-4 py-3 text-left font-semibold hover:border-emerald-700" onClick={() => selectSubtype(intentFamily, part.key)}>{part.label}</button>)}<button type="button" className={secondary} onClick={() => setStep(1)}>Retour</button></div>}
      {step === 3 && <div id="builder-context" className="mt-4 grid gap-4"><p className="text-sm font-semibold text-emerald-900">{familyLabel(draft.familyKey)}{draft.subtypeKey ? ` · ${subtypeLabel(draft.familyKey, draft.subtypeKey)}` : ""}</p>
        <label id="builder-title" className="grid gap-1 text-sm font-semibold">Comment l’appeler ?<input className={inputClass} value={draft.title} maxLength={120} onChange={(event) => { setDraft({ ...draft, title: event.target.value }); resetPreview(); }} /></label>
        <label className="grid gap-1 text-sm font-semibold">Date prévue, si vous la connaissez<input className={inputClass} type="date" min={`${targetMonth}-01`} max={monthEnd(targetMonth)} value={draft.plannedDate ?? ""} onChange={(event) => { setDraft({ ...draft, plannedDate: event.target.value || null }); resetPreview(); }} /></label>
        {isWorkMeal && <fieldset className="rounded-xl border border-slate-200 p-3"><legend className="px-1 text-sm font-bold">Pour qui ?</legend><div className="flex flex-wrap gap-4">{persons.filter((person) => ["Adrien", "Manon"].includes(person.displayName)).map((person) => <label key={person.personId} className="flex gap-2"><input type="radio" name="work-meal-person" checked={draft.context.participantPersonIds?.includes(person.personId) ?? false} onChange={() => setPerson(person)} />{person.displayName}</label>)}</div></fieldset>}
        {isVisit && <label className="grid gap-1 text-sm font-semibold">Qui allons-nous voir ?<select className={inputClass} value={draft.context.personVisited?.kind === "CONTACT" ? draft.context.personVisited.contactKey : visited ? "OTHER" : ""} onChange={(event) => {
          const value = event.target.value; const personVisited = value === "OTHER" ? { kind: "TEXT" as const, label: "" }
            : value ? { kind: "CONTACT" as const, contactKey: value } : undefined;
          setBuilder((current) => changeBuilderContext(current, { ...current.draft.context, personVisited })); resetPreview(); }}><option value="">Choisir une personne</option>{(draft.subtypeKey === "family_visit" ? visitedFamily : visitedFriends).map((contact) => <option key={contact.key} value={contact.key}>{contact.label}</option>)}<option value="OTHER">Autre personne</option></select></label>}
        {isVisit && draft.context.personVisited?.kind === "TEXT" && <label className="grid gap-1 text-sm font-semibold">Son nom<input className={inputClass} value={draft.context.personVisited.label} onChange={(event) => { setBuilder((current) => changeBuilderContext(current, { ...current.draft.context, personVisited: { kind: "TEXT", label: event.target.value } })); resetPreview(); }} /></label>}
        {draft.subtypeKey === "house_party" && <fieldset className="rounded-xl border border-slate-200 p-3"><legend className="font-bold">Où aura lieu la soirée ?</legend>{([ ["OWN_HOME", "Chez nous"], ["OTHER_HOME", "Chez quelqu’un d’autre"] ] as const).map(([value, label]) => <label key={value} className="mr-5 inline-flex gap-2"><input type="radio" name="house-party-place" checked={draft.context.housePartyPlaceMode === value} onChange={() => { setBuilder((current) => changeBuilderContext(current, { ...current.draft.context, housePartyPlaceMode: value })); resetPreview(); }} />{label}</label>)}</fieldset>}
        {resolved?.fields.host === "REQUIRED" && <PlannedContactField label="Chez qui ?" value={draft.context.host} onChange={(host) => { setBuilder((current) => changeBuilderContext(current, { ...current.draft.context, host })); resetPreview(); }} />}
        {isVisit && <label className="grid gap-1 text-sm font-semibold">Comment se passe la visite ?<select className={inputClass} value={draft.context.visitFormat ?? "SIMPLE"} onChange={(event) => { setBuilder((current) => changeBuilderContext(current, { ...current.draft.context, visitFormat: event.target.value as PlannedExpenseContext["visitFormat"] })); resetPreview(); }}><option value="SIMPLE">Visite simple</option><option value="APERO_PARTY">Apéro / soirée</option><option value="MEAL">Repas</option><option value="STAY">Séjour</option></select></label>}
        {isVisit && <label className="grid gap-1 text-sm font-semibold">Occasion<select className={inputClass} value={draft.context.socialOccasion ?? "NONE"} onChange={(event) => { setBuilder((current) => changeBuilderContext(current, { ...current.draft.context, socialOccasion: event.target.value as PlannedExpenseContext["socialOccasion"] })); resetPreview(); }}><option value="NONE">Sans occasion particulière</option><option value="BIRTHDAY">Anniversaire</option><option value="CHRISTMAS">Noël</option><option value="CELEBRATION">Fête</option><option value="OTHER_SPECIAL">Autre occasion</option></select></label>}
        {resolved?.fields.purchaseMode !== "HIDDEN" && <fieldset className="rounded-xl border border-slate-200 p-3"><legend className="px-1 text-sm font-bold">{draft.subtypeKey === "fast_food" ? "Comment manger ?" : "Mode d’achat"}</legend><div className="flex flex-wrap gap-4">{(draft.subtypeKey === "fast_food" ? [["TAKEAWAY", "Sur place / à emporter"], ["DELIVERY", "En livraison"]] : [["IN_STORE", "Magasin physique"], ["ONLINE", "En ligne / livraison"]]).map(([value, label]) => <label key={value} className="flex gap-2"><input type="radio" name="purchase-mode" checked={draft.context.purchaseMode === value} onChange={() => { setBuilder((current) => changeBuilderContext(current, { ...current.draft.context, purchaseMode: value as PlannedExpenseContext["purchaseMode"], ...(value !== "DELIVERY" ? { deliveryProvider: undefined, deliveryProviderKey: undefined } : {}) })); resetPreview(); }} />{label}</label>)}</div></fieldset>}
        {draft.context.purchaseMode === "DELIVERY" && <label className="grid gap-1 text-sm font-semibold">Qui livre ?<input className={inputClass} list="planned-delivery-services" value={draft.context.deliveryProvider ?? ""} onChange={(event) => { const provider = DELIVERY_PROVIDERS.find((item) => item.label === event.target.value);
          setDraft({ ...draft, context: { ...draft.context, deliveryProvider: event.target.value,
            deliveryProviderKey: provider?.key ?? "OTHER" } }); resetPreview(); }} /><datalist id="planned-delivery-services">{DELIVERY_PROVIDERS.filter((item) => item.key !== "OTHER").map((item) => <option key={item.key} value={item.label} />)}</datalist></label>}
        {["ONLINE", "DELIVERY"].includes(draft.context.purchaseMode ?? "") && <label className="grid gap-1 text-sm font-semibold">Quelle boutique ou quel restaurant ?<input className={inputClass} list="planned-online-stores" value={draft.context.seller ?? ""} onChange={(event) => { setDraft({ ...draft, context: { ...draft.context, seller: event.target.value } }); resetPreview(); }} /><datalist id="planned-online-stores"><option value="McDonald’s" /><option value="Burger King" /><option value="Thai to Box" /><option value="Shein" /><option value="Amazon" /></datalist></label>}
        {draft.subtypeKey === "gift" && <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Pour qui ?<input className={inputClass} list="planned-social-contacts" value={draft.context.gift?.recipient ?? ""} onChange={(event) => setDraft({ ...draft, context: { ...draft.context, gift: { recipient: event.target.value, occasion: draft.context.gift?.occasion ?? "Sans occasion particulière" } } })} /></label><label className="grid gap-1 text-sm font-semibold">Pour quelle occasion ?<select className={inputClass} value={draft.context.gift?.occasion ?? "Sans occasion particulière"} onChange={(event) => setDraft({ ...draft, context: { ...draft.context, gift: { recipient: draft.context.gift?.recipient ?? "", occasion: event.target.value } } })}>{["Anniversaire", "Noël", "Fête", "Sans occasion particulière", "Autre"].map((part) => <option key={part}>{part}</option>)}</select></label></div>}
        <details className="rounded-xl border border-slate-200 p-3" open={resolved?.fields.place === "REQUIRED" ? true : undefined}><summary className="cursor-pointer font-bold">{resolved?.fields.place === "REQUIRED" ? "Lieu nécessaire" : "Détailler · personnes et lieu"}</summary><div className="mt-3 grid gap-3">
          {supportsParticipants && !isWorkMeal && <PlannedParticipants context={draft.context} persons={persons} onChange={(context) => { setBuilder((current) => changeBuilderContext(current, context)); resetPreview(); }} />}
          {resolved?.fields.place !== "HIDDEN" && <label className="grid gap-1 text-sm font-semibold">{isVisit ? "Destination" : "Lieu"} {resolved?.fields.place === "REQUIRED" ? "(nécessaire)" : "(facultatif)"}<select className={inputClass} value={draft.context.place?.kind === "KNOWN" ? draft.context.place.placeId : draft.context.place?.kind === "TEXT" ? "TEXT" : ""} onChange={(event) => {
            const value = event.target.value; const place = value === "TEXT" ? { kind: "TEXT" as const, label: "" } : value ? { kind: "KNOWN" as const, placeId: value } : undefined;
            setBuilder((current) => editBuilderDraft({ ...current, origins: { ...current.origins, place: "EXPLICIT" } }, { ...current.draft, context: { ...current.draft.context, place } })); resetPreview(); }}><option value="">Sans lieu précis</option>{relevantPlaces.map((place) => <option key={place.placeId} value={place.placeId}>{place.name}</option>)}<option value="TEXT">Saisir un autre lieu</option></select></label>}
          {resolved?.fields.place !== "HIDDEN" && draft.context.place?.kind === "TEXT" && <label className="grid gap-1 text-sm font-semibold">Nom du lieu<input className={inputClass} value={draft.context.place.label} onChange={(event) => { setDraft({ ...draft, context: { ...draft.context, place: { kind: "TEXT", label: event.target.value } } }); resetPreview(); }} /></label>}
          {isVisit && relevantPlaces.length === 0 && !draft.context.place && <p className="text-xs text-slate-600">Aucun lieu lié à cette personne n’est confirmé dans les données. Vous pouvez saisir une destination prévue.</p>}
        </div></details>
        <div className="flex flex-wrap gap-2"><button type="button" className={secondary} onClick={() => { setIntentFamily(draft.familyKey); setStep(1); }}>Retour</button><button type="button" className={primary} disabled={!contextValid || draft.context.place?.kind === "TEXT" && !draft.context.place.label.trim()} onClick={() => setStep(4)}>Continuer</button></div>
      </div>}
      {step === 4 && <div id="builder-cost" className="mt-4 grid gap-5"><div><p className="text-sm text-slate-600">Commencez par un montant global. Détaillez seulement si cela change le calcul ou le financement.</p>
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex flex-wrap gap-2"><button type="button" className={secondary} disabled={builder.costMode !== "QUICK_TOTAL" && draft.costItems.filter(isRootCost).some((item) => item.assetKey !== null || item.fundingAllocations?.length) || !!realityMode && !canCollapseRealityCosts(draft.costItems)} onClick={() => { if (builder.costMode === "QUICK_TOTAL") return; try { setBuilder(collapseBuilderCosts(builder)); setError(""); } catch { setError("Ces lignes ont des règles de financement ou d’impact différentes : gardez la ventilation."); } }}>Total rapide</button><button type="button" className={secondary} onClick={() => setBuilder(itemizeBuilderCosts)}>Détailler les éléments</button></div>
          {builder.costMode !== "QUICK_TOTAL" && draft.costItems.filter(isRootCost).some((item) => item.assetKey !== null || item.fundingAllocations?.length) && <p className="mt-2 text-xs">Le détail conserve des règles distinctes de financement. Modifiez ses lignes ou annulez la conversion pour retrouver le total.</p>}
          {realityMode && !canCollapseRealityCosts(draft.costItems) && <p className="mt-2 text-sm">Corrigez les lignes du détail pour obtenir le coût final. Aucun écart global n’est réparti automatiquement.</p>}
          {builder.costMode === "QUICK_TOTAL" && <label className="mt-3 grid max-w-xs gap-1 text-sm font-semibold">Montant prévu (€)<input className={inputClass} type="number" min="0.01" step="0.01" value={builder.quickTotal} onChange={(event) => setBuilder((current) => setQuickTotal(current, event.target.value))} /></label>}
          {builder.costMode === "QUICK_TOTAL" && resolved?.baseline.mode === "ASK" && resolved.baseline.key && <fieldset className="mt-3 text-sm"><legend className="font-semibold">{baselineQuestion(root)}</legend><label className="mr-5 inline-flex gap-2"><input type="radio" name="quick-baseline" checked={builder.quickBaseline === null} onChange={() => setBuilder((current) => setQuickBaseline(current, null))} />Oui, en plus</label><label className="inline-flex gap-2"><input type="radio" name="quick-baseline" checked={builder.quickBaseline === resolved.baseline.key} onChange={() => setBuilder((current) => setQuickBaseline(current, resolved.baseline.key))} />Non, remplace une dépense habituelle</label></fieldset>}
          {builder.costMode === "QUICK_TOTAL" && draft.subtypeKey === "restaurant" && builder.quickTotal && <div className="mt-3 grid max-w-md gap-2"><p className="text-sm">Besoin de séparer le repas et l’alcool pour le financement ?</p><label className="grid gap-1 text-sm">Part repas et boissons sans alcool (€)<input className={inputClass} type="number" min="0.01" step="0.01" value={splitMeal} onChange={(event) => setSplitMeal(event.target.value)} /></label><button type="button" className={secondary} onClick={() => { try { setBuilder(splitRestaurantQuickTotal(builder, splitMeal)); setError(""); } catch { setError("La part repas doit être comprise dans le total."); } }}>Ventiler le total</button></div>}
          {builder.costMode === "TARGETED_SPLIT" && <p className="mt-2 text-sm">Total ventilé : modifiez chaque part ci-dessous. Le total évoluera avec vos modifications.</p>}</div>
        <>
        <div className="mt-3 flex flex-wrap items-center gap-2"><strong className="text-sm">{path.map(moduleLabel).join(" › ")}</strong>{path.length > 1 && <button type="button" className={secondary} onClick={() => { setModulePath(path.slice(0, -1)); setSearch(""); }}>Revenir au module parent</button>}</div>
        {path.length === 1 && builder.acceptedChildren.length > 0 && <div className="mt-2 flex gap-2">{builder.acceptedChildren.filter((child) => resolved?.children.some((edge) => edge.childModule === child)).map((child) => <button key={child} type="button" className={secondary} onClick={() => { setModulePath([root, child]); setAssetLens("MODULE"); setSearch(""); }}>Modifier {moduleLabel(child)}</button>)}</div>}
        {builder.acceptedChildren.includes("gift") && draft.subtypeKey !== "gift" && <label className="mt-3 grid max-w-md gap-1 text-sm font-semibold">Pour qui est le cadeau ?<input className={inputClass} list="planned-social-contacts" value={draft.context.gift?.recipient ?? ""} onChange={(event) => { setDraft({ ...draft, context: { ...draft.context, gift: { recipient: event.target.value, occasion: draft.context.gift?.occasion ?? "Sans occasion particulière" } } }); resetPreview(); }} /></label>}
        {module === "house_party" && <button type="button" className={`${secondary} mt-3`} onClick={() => { addAsset(assetsForModule("house_party")[0]); addAsset(assetsForModule("house_party")[1]); }}>Ajouter le panier suggéré · Vodka 1 × 16 € et Crazy Tiger 2 × 3 €</button>}
        {isVisit && <button type="button" className={`${secondary} mt-3`} onClick={() => { setAssetLens("BRING_ITEMS"); setModulePath([root]); setSearch(""); }}>Apporter quelque chose ?</button>}
        <details className="mt-3 rounded-xl border border-slate-200 p-3" open={builder.costMode === "ITEMIZED" || path.length === 2 || assetLens === "BRING_ITEMS" ? true : undefined}><summary className="cursor-pointer font-bold">Ajouter des compléments</summary><label className="mt-3 grid gap-1 text-sm font-semibold">Rechercher un élément<input className={inputClass} type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <div id="builder-addons" className="mt-3"><div className="flex flex-wrap gap-2">{suggestedBuilderChildren(builder).map((child) => <button key={child} type="button" className={secondary} onClick={() => { setBuilder((current) => acceptBuilderChild(current, child)); setModulePath([root, child]); setAssetLens("MODULE"); setSearch(""); }}>Ajouter {moduleLabel(child)} · suggestion</button>)}</div>
          {availableBuilderChildren(builder).length > 0 && <details className="mt-2"><summary className="cursor-pointer text-sm font-semibold">Ajouter autre chose</summary><div className="mt-2 flex flex-wrap gap-2">{availableBuilderChildren(builder).map((child) => <button key={child} type="button" className={secondary} onClick={() => { setBuilder((current) => acceptBuilderChild(current, child)); setModulePath([root, child]); setAssetLens("MODULE"); setSearch(""); }}>Ajouter {moduleLabel(child)}</button>)}</div></details>}</div>
        {path.length === 1 && assetLens === "MODULE" && draft.costItems.some((item) => item.id === "00000000-0000-4000-8000-000000000001") && <p className="mt-3 text-sm text-amber-900">Le prochain élément remplacera le total rapide. Annuler le dernier changement restaure ce total.</p>}
        {(builder.costMode !== "QUICK_TOTAL" || path.length === 2 || assetLens === "BRING_ITEMS") && <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{visibleAssets.map((asset) => { const knownPrice = prices.find((price) => price.assetKey === asset.assetKey); const selected = draft.costItems.some((item) => item.assetKey === asset.assetKey && JSON.stringify(item.modulePath) === JSON.stringify(path)); return <button key={asset.assetKey} type="button" disabled={selected} aria-pressed={selected} className="rounded-xl disabled:border-emerald-700 disabled:bg-emerald-50 border border-slate-200 p-3 text-left text-sm hover:border-emerald-700" onClick={() => addAsset(asset)}><span aria-hidden="true">{asset.icon} </span>{asset.label}{selected && <span className="ml-2 font-bold text-emerald-800">✓ Ajouté</span>}{knownPrice ? <span className="block text-xs text-slate-600">Prix récent : {money(knownPrice.unitAmount)} · {knownPrice.sourceLabel}</span> : asset.defaultUnitAmount && <span className="block text-xs text-slate-600">Suggestion : {asset.defaultQuantity} × {money(asset.defaultUnitAmount)}</span>}</button>; })}</div>}
        <button type="button" className={`${secondary} mt-3`} disabled={draft.costItems.length >= 50} onClick={() => addAsset()}><Plus size={14} className="mr-1 inline" />{builder.costMode === "QUICK_TOTAL" && path.length === 1 ? "Remplacer le total par des éléments" : "Ajouter un élément personnalisé"}</button></details>
        {resolved?.suggestedFeeAssetKeys.length ? <div className="flex gap-2">{resolved.suggestedFeeAssetKeys.map((key) => <button key={key} type="button" className={secondary} disabled={draft.costItems.some((item) => item.assetKey === key)} onClick={() => addAsset(plannedAsset(key))}>Prévoir {plannedAsset(key)?.label.toLocaleLowerCase("fr")} · montant à saisir</button>)}</div> : null}
        {draft.context.purchaseMode === "DELIVERY" && resolved?.suggestedFeeAssetKeys.length === 0 && <div className="flex gap-2">{["fast_food:delivery_fee", "fast_food:service_fee"].map((key) => <button key={key} type="button" className={secondary} disabled={draft.costItems.some((item) => item.assetKey === key)} onClick={() => addAsset(plannedAsset(key))}>Ajouter {plannedAsset(key)?.label.toLocaleLowerCase("fr")} si nécessaire</button>)}</div>}
        <PlannedRouteEditor key={requestId} builder={builder} setBuilder={setBuilder} places={places} vehicle={vehicle} targetMonth={targetMonth} persons={persons} />
        {builder.costMode !== "QUICK_TOTAL" && [...new Set(draft.costItems.filter((item) => costAllowsBaseline(item)).map((item) => item.modulePath?.at(-1) ?? root))].map((costModule) => {
          const habitual = baselineFor(costModule, draft.context.participantPersonIds ?? [], persons);
          const group = draft.costItems.filter((item) => (item.modulePath?.at(-1) ?? root) === costModule && costAllowsBaseline(item) && (!item.assetKey || plannedAsset(item.assetKey)?.module === costModule));
          const overridden = costModule !== root && resolved?.children.find((edge) => edge.childModule === costModule)?.baselineOverride === null;
          if (!habitual || !group.length || overridden) return null;
          const answered = group.every((item) => builder.origins[`baseline.${item.id}`]);
          const setGroupBaseline = (baselineKey: PlannedBaselineKey | null) => setBuilder((current) => editBuilderDraft({ ...current,
            origins: { ...current.origins, ...Object.fromEntries(group.map((item) => [`baseline.${item.id}`, "EXPLICIT" as const])) } },
            { ...current.draft, costItems: current.draft.costItems.map((item) => group.some((part) => part.id === item.id) ? { ...item, baselineKey } : item) }));
          return <fieldset key={costModule} className="rounded-xl bg-slate-50 p-3 text-sm"><legend className="font-semibold">{baselineQuestion(costModule)}</legend>
            <label className="mr-4 inline-flex gap-2"><input type="radio" name={`module-baseline-${costModule}`} checked={answered && group.every((item) => item.baselineKey === null)} onChange={() => setGroupBaseline(null)} />Oui, en plus</label>
            <label className="inline-flex gap-2"><input type="radio" name={`module-baseline-${costModule}`} checked={group.every((item) => item.baselineKey === habitual)} onChange={() => setGroupBaseline(habitual)} />Non, remplace une dépense habituelle</label>
            <p className="mt-1 text-xs">Une dépense habituelle utilise d’abord l’enveloppe du mois : elle n’est pas comptée deux fois.</p></fieldset>;
        })}
        {["beauty", "gift", "household"].includes(draft.subtypeKey ?? "") && draft.costItems.length > 0 && <label className="grid gap-1 text-sm font-semibold">Boutique pour les éléments choisis<select className={inputClass} value={draft.context.place?.kind === "KNOWN" ? draft.context.place.placeId : draft.context.place?.kind === "TEXT" ? "TEXT" : ""}
          onChange={(event) => { const place = event.target.value === "TEXT" ? { kind: "TEXT" as const, label: "" } : event.target.value ? { kind: "KNOWN" as const, placeId: event.target.value } : undefined; setDraft({ ...draft, context: { ...draft.context, place } }); resetPreview(); }}><option value="">Sans boutique précisée</option>{relevantPlaces.map((place) => <option key={place.placeId} value={place.placeId}>{place.name}</option>)}<option value="TEXT">Autre boutique à saisir</option></select>
          {draft.context.place?.kind === "TEXT" && <input aria-label="Nom de la boutique" className={inputClass} value={draft.context.place.label} onChange={(event) => { setDraft({ ...draft, context: { ...draft.context, place: { kind: "TEXT", label: event.target.value } } }); resetPreview(); }} />}</label>}
        <div className="grid gap-3">{draft.costItems.map((item, index) => {
          const itemModule = item.modulePath?.at(-1) ?? root;
          const edge = item.modulePath?.[1] ? resolved?.children.find((candidate) => candidate.childModule === item.modulePath?.[1]) : undefined;
          const habitual = edge?.baselineOverride === null || !costAllowsBaseline(item) || assetLens === "BRING_ITEMS" && plannedAsset(item.assetKey ?? "")?.module !== itemModule ? null : baselineFor(itemModule, draft.context.participantPersonIds ?? [], persons);
          const asset = item.assetKey ? plannedAsset(item.assetKey) : undefined;
          return <div key={item.id} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between gap-2"><strong className="text-sm">{item.label || `Élément ${index + 1}`}</strong><button type="button" className={secondary} aria-label={`Supprimer l’élément ${index + 1}`} onClick={() => { setDraft({ ...draft, costItems: draft.costItems.filter((part) => part.id !== item.id) }); resetPreview(); }}><Trash2 size={14} /></button></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_10rem]"><label className="grid gap-1 text-sm font-semibold">Élément<input className={inputClass} value={item.label} maxLength={120} onChange={(event) => updateItem(item.id, { label: event.target.value })} /></label><label className="grid gap-1 text-sm font-semibold">Quantité<input className={inputClass} type="number" min="0.001" step="0.001" value={item.quantity} disabled={item.assetKey === "transport:fuel_usage"} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} /></label><label className="grid gap-1 text-sm font-semibold">Prix unitaire (€)<input className={inputClass} type="number" min="0.01" step="0.01" value={item.unitAmount} disabled={item.assetKey === "transport:fuel_usage"} onChange={(event) => updateItem(item.id, { unitAmount: event.target.value, priceSource: "MANUAL" })} /></label></div>
            {(item.assetKey?.endsWith(":cocktail") || item.assetKey?.endsWith(":mixer")) && <label className="mt-3 grid gap-1 text-sm font-semibold">Quel parfum ou cocktail ?<input className={inputClass} value={item.variantLabel ?? ""} onChange={(event) => updateItem(item.id, { variantLabel: event.target.value || null })} placeholder="Ex. Mojito" /></label>}
            <p className="mt-2 text-xs text-slate-600">{item.priceSource === "SYSTEM_DEFAULT" ? "Prix proposé · modifiable" : item.priceSource === "CALCULATED" ? "Estimation calculée" : item.priceSource === "LAST_KNOWN" ? "Prix récent" : "Prix à confirmer"}{itemTotal(item) ? ` · total ${money(itemTotal(item)!)}` : ""}</p>
            {habitual && <details className="mt-2 text-sm"><summary className="cursor-pointer">Préciser les habitudes pour cette ligne</summary><fieldset className="mt-3 flex flex-wrap gap-4 text-sm"><legend className="font-semibold">Cette dépense fait-elle partie de vos habitudes ?</legend><label className="flex gap-2"><input type="radio" name={`habitual-${item.id}`} checked={item.baselineKey === null && !!builder.origins[`baseline.${item.id}`]} onChange={() => updateItem(item.id, { baselineKey: null })} />S’ajoute à vos dépenses habituelles</label><label className="flex gap-2"><input type="radio" name={`habitual-${item.id}`} checked={item.baselineKey === habitual} onChange={() => updateItem(item.id, { baselineKey: habitual })} />Fait partie de vos dépenses habituelles</label></fieldset></details>}
            {asset?.fundingEligibility === "MEAL" && edge?.fundingOverride !== "BANK_ONLY" && <div id={`funding-${item.id}`} className="mt-3 grid gap-2"><label className="grid gap-1 text-sm font-semibold">Comment financer cet élément ?<select className={inputClass} value={fundingMode(item)} onChange={(event) => setFunding(item, event.target.value as "BANK" | "SWILE" | "EDENRED" | "MIXED")}><option value="BANK">Banque</option><option value="SWILE">Swile</option><option value="EDENRED">Edenred</option><option value="MIXED" disabled={!itemTotal(item) || new Big(itemTotal(item)!).lt("0.02")}>Mixte</option></select></label>{fundingMode(item) === "MIXED" && <div className="grid gap-2 sm:grid-cols-3">{(["BANK", "SWILE", "EDENRED"] as const).map((source) => <label key={source} className="grid gap-1 text-sm">{source === "BANK" ? "Banque" : source} (€)<input className={inputClass} type="number" min="0" step="0.01" value={item.fundingAllocations?.find((part) => part.source === source)?.amount ?? ""} onChange={(event) => editAllocation(item, source, event.target.value)} /></label>)}</div>}</div>}
            {readiness.issues.some((problem) => problem.code === "FUNDING_INCOMPLETE" && problem.scope === `costItems.${item.id}.fundingAllocations`)
              && ["SWILE", "EDENRED"].includes(fundingMode(item)) && itemTotal(item) && <button type="button" className={secondary}
                onClick={() => setFunding(item, fundingMode(item) as "SWILE" | "EDENRED")}>Confirmer {fundingMode(item)} pour {money(itemTotal(item)!)}</button>}
          </div>;
        })}</div></></div>
        <div className="flex flex-wrap gap-2"><button type="button" className={secondary} onClick={() => setStep(3)}>Retour</button><button type="button" className={primary} disabled={!canPreview || busy} onClick={simulate}>{busy ? "Simulation…" : "Voir l’effet sur notre mois"}</button></div>
      </div>}
      {step === 5 && !previewCurrent && <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm">L’aperçu précédent n’est plus à jour. <button type="button" className={secondary} onClick={() => setStep(4)}>Recalculer après modification</button></div>}
      {step === 5 && previewCurrent && preview && <div className="mt-4 grid gap-4"><PlannedImpactCard preview={preview} fundingIncomplete={readiness.issues.some((issue) => issue.code === "FUNDING_INCOMPLETE")} />
        <p className="text-xs text-slate-600">La simulation n’enregistre rien.</p><div className="flex flex-wrap gap-2"><button type="button" className={secondary} onClick={() => { setPreview(null); setStep(4); }}>Modifier</button><button type="button" className={primary} disabled={busy || !readiness.saveReady} onClick={save}>{busy ? "Enregistrement…" : realityMode === "DECLARE" ? "Confirmer la réalisation" : realityMode === "CORRECT" ? "Enregistrer la déclaration corrigée" : editedId ? "Enregistrer la modification" : simulationMode ? "Ajouter réellement au mois" : "Ajouter au mois"}</button></div></div>}
    </div>}
    <div className="mt-6 grid gap-5 lg:grid-cols-2"><div><h3 className="text-base font-black">À venir / prévues ({planned.length})</h3>{planned.length ? <ul className="mt-3 grid gap-3">{planned.map(card)}</ul> : <p className="mt-2 text-sm text-slate-600">Aucune dépense ajoutée pour l’instant.</p>}</div><div><h3 className="text-base font-black">Réalisées ce mois-ci ({realized.length})</h3>{realized.length ? <ul className="mt-3 grid gap-3">{realized.map(card)}</ul> : <p className="mt-2 text-sm text-slate-600">Aucune prévision marquée comme réalisée.</p>}</div></div>
    {(new Big(funding.swile.reserved).gt(0) || new Big(funding.edenred.reserved).gt(0) || new Big(funding.swile.usedDeclared).gt(0) || new Big(funding.edenred.usedDeclared).gt(0)) && <p className="mt-4 text-xs text-slate-600">Financement du mois : Swile {money(funding.swile.reserved)} réservés et {money(funding.swile.usedDeclared)} utilisés déclarés ; Edenred {money(funding.edenred.reserved)} réservés et {money(funding.edenred.usedDeclared)} utilisés déclarés. Aucun solde réel n’est débité.</p>}
  </section>;
}
