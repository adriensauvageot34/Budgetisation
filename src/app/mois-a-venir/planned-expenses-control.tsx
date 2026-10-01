"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import Big from "big.js";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { PLANNED_FAMILIES, PLANNED_SUBTYPE_LABELS, type PlannedExpenseFamily } from "@/domain/phase2/planned-assets";
import { createBuilderState, changeBuilderRoot, deriveBuilderReadiness, materializeBuilderDraft, synchronizeIntentBuilder, adoptBuilderResolvedTransport } from "@/domain/phase2/planned-builder";
import { projectPlaceLabel, intentForDraft, BUILDER_INTENTS } from "@/domain/phase2/planned-ux";
import type { PlannedPlaceOption } from "@/domain/phase2/planned-places";
import type { PlannedPriceSuggestion, PlannedVehicleEstimate, PlannedWalletOption } from "@/domain/phase2/planned-contract";
import { PlannedIntentBuilder } from "./planned-intent-builder";
import { ContextualBlockerCTA } from "./planned-builder-primitives";
import type { PlannedExpenseCard } from "./planned-expenses-projection";
import { confirmPlannedExpenseReality, restorePlannedExpenseAction, reportPlannedExpenseAction,
  previewPlannedExpense, removePlannedExpense, savePlannedExpense } from "./planned-expenses-actions";
import { type PlannedIssue, type PlannedResult, type RealityConfirmationDraft } from "@/domain/phase2/planned-mutations";
import { PlannedImpactCard } from "./planned-impact-card";
import { usePlannedExpenseInteractions } from "./planned-expense-interactions";
import { calendarExpenseActions } from "./calendar-presentation";

type Person = { personId: string; displayName: string };
type Draft = Pick<PlannedExpenseCard, "familyKey" | "subtypeKey" | "title" | "plannedDate" | "costItems" | "context">;
type Preview = Extract<Awaited<ReturnType<typeof previewPlannedExpense>>, { ok: true }>["value"];
type Funding = NonNullable<Preview["funding"]>;
type Props = { targetMonth: string; expenses: readonly PlannedExpenseCard[]; persons: readonly Person[];
  places: readonly PlannedPlaceOption[]; vehicle: PlannedVehicleEstimate | null;
  prices: readonly PlannedPriceSuggestion[]; wallets: readonly PlannedWalletOption[]; funding: Funding };

const money = (value: string) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR",
  minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
const dateLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" })
  .format(new Date(`${value}T12:00Z`));
const inputClass = "min-h-11 min-w-0 w-full rounded-xl border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-emerald-700";
const secondary = "min-h-10 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-700";
const primary = "min-h-11 rounded-xl bg-emerald-800 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-900 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-emerald-700";
const emptyDraft = (): Draft => ({ familyKey: "outing", subtypeKey: null, title: "", plannedDate: null,
  costItems: [], context: {} });
const familyLabel = (family: PlannedExpenseFamily) => PLANNED_FAMILIES.find((part) => part.key === family)?.label ?? "Projet";
const subtypeLabel = (family: PlannedExpenseFamily, subtype: string | null) =>
  PLANNED_SUBTYPE_LABELS[family].find((part) => part.key === subtype)?.label ?? "";
function unwrap<T>(result: PlannedResult<T>): T {
  if (!result.ok) throw Object.assign(new Error(result.issue.message), { issue: result.issue });
  return result.value;
}

export function PlannedExpensesControl({ targetMonth, expenses, persons, places, vehicle, prices, wallets, funding }: Props) {
  const router = useRouter();
  const interactions = usePlannedExpenseInteractions();
  const [open, setOpen] = useState(false);
  const [simulationMode, setSimulationMode] = useState(false);
  const [step, setStep] = useState(1);
  const [closeRequested, setCloseRequested] = useState(false);
  const [builder, setBuilderState] = useState(() => createBuilderState(emptyDraft()));
  const draft = builder.draft;
  const setBuilder: Dispatch<SetStateAction<typeof builder>> = (change) => setBuilderState((state) => {
    const next = typeof change === "function" ? change(state) : change;
    return next.draft.subtypeKey || next.draft.familyKey === "other" ? synchronizeIntentBuilder(next, places, persons) : next;
  });
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const isWorkMeal = draft.familyKey === "food" && draft.subtypeKey === "work_meal";
  const contextPersonLabel = persons.find((person) => person.personId === draft.context.participantPersonIds?.[0])?.displayName;
  const readiness = deriveBuilderReadiness(builder, { places, workMealPersonName: isWorkMeal ? contextPersonLabel : undefined });
  const canPreview = readiness.previewReady;
  const planned = expenses.filter((item) => item.status === "PLANNED");
  const realized = expenses.filter((item) => item.status === "DECLARED_REALIZED");
  const previewCurrent = preview !== null && previewRevision === builder.revision && preview.targetMonth === targetMonth;

  const resetPreview = () => { setPreview(null); setError(""); setIssue(null); };
  const start = (item?: PlannedExpenseCard, mode: "DECLARE" | "CORRECT" | null = null, plannedDate?: string) => {
    setSimulationMode(false);
    if (inFlight.current) return;
    draftSession.current++;
    const next = item ? { familyKey: item.familyKey, subtypeKey: item.subtypeKey, title: item.title,
      plannedDate: item.plannedDate, costItems: item.costItems.map((cost) => ({ ...cost })), context: { ...item.context } } : { ...emptyDraft(), plannedDate: plannedDate ?? null };
    setBuilder(createBuilderState(next));
    setRequestId(item?.id ?? crypto.randomUUID()); setExpectedUpdatedAt(item?.updatedAt); setRealityMode(mode);
    setIssue(null); setNotice(""); setReportId(null); setDeleteId(null);
    setCloseRequested(false);
    setEditedId(item?.id); setPreview(null); setPreviewRevision(null); setError(""); setStep(item ? 3 : 1); setOpen(true);
    window.setTimeout(() => { const target = document.getElementById("planned-expense-builder"); target?.scrollIntoView({ behavior: "smooth" }); target?.focus(); }, 0);
  };
  const selectSubtype = (family: PlannedExpenseFamily, subtype: string | null) => {
    const label = subtypeLabel(family, subtype) || familyLabel(family);
    setBuilder((state) => { const nextDraft = { familyKey: family, subtypeKey: subtype, title: label,
      plannedDate: state.draft.plannedDate, costItems: [], context: {
        ...(subtype === "family_visit" ? { participantPersonIds: [], visitTiming: { outbound: { date: state.draft.plannedDate, time: null }, return: { required: true as const, date: null, time: null } } }
          : subtype !== "work_meal" ? { participantPersonIds: persons.map((person) => person.personId) } : { workMealMode: "BOUGHT" as const }),
        ...(subtype === "fast_food" ? { purchaseMode: "IN_STORE" as const } : {}),
        ...(subtype === "groceries" ? { groceriesNature: "USUAL" as const } : {}),
        ...(subtype === "house_party" ? { housePartyPlaceMode: "OWN_HOME" as const } : {}),
        ...(subtype === "club_festival" ? { outingKind: "CLUB" as const } : {}),
      } };
      const hasExplicit = state.draft.costItems.length || state.quickTotal || state.draft.context.route
        || state.draft.context.personVisited || state.draft.context.host || state.draft.context.seller
        || state.draft.context.socialOccasion || state.draft.context.place;
      return hasExplicit ? changeBuilderRoot(state, nextDraft) : { ...createBuilderState(nextDraft), revision: state.revision + 1 };
    });
    setStep(3); resetPreview();
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
      const adopted = synchronizeIntentBuilder(adoptBuilderResolvedTransport(builder, value.resolvedDraft), places, persons);
      setBuilderState(adopted); setPreview(value); setPreviewRevision(adopted.revision); setStep(5); }
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
    {notice && <p role="status" className="mt-3 rounded-xl bg-emerald-100 p-3 text-sm">{notice}</p>}
    {error && !open && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}{issue?.repairTarget === "reload" && <button className={secondary} onClick={() => router.refresh()}>Recharger la liste</button>}{issue?.repairTarget === "month" && reportDate && <a className="ml-2 underline" href={`/mois-a-venir?month=${reportDate.slice(0, 7)}`}>Préparer les ressources de ce mois</a>}</p>}
    {open && <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold text-indigo-700">Projets{step > 1 && (" › " + (BUILDER_INTENTS.find((intent) => intent.key === intentForDraft(draft))?.label ?? "Projet"))}{step === 5 && " › Aperçu"}</p><h3 className="mt-2 text-2xl font-black tracking-tight">{step === 1 ? "Qu’avez-vous prévu ?" : draft.title}</h3>{step > 2 && <p className="mt-2 text-sm text-slate-500">{[draft.plannedDate ? dateLabel(draft.plannedDate) : "Ce mois-ci", projectPlaceLabel(draft.context, places)].filter(Boolean).join(" · ")}</p>}</div><button type="button" className={secondary} onClick={() => { if (builder.revision > 0) setCloseRequested(true); else setOpen(false); }}>Fermer</button></div>
      {closeRequested && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm"><p>Quitter et abandonner les modifications de ce brouillon ?</p><button type="button" className={secondary} onClick={() => { setOpen(false); setPreview(null); setCloseRequested(false); }}>Abandonner</button><button type="button" className={secondary} onClick={() => setCloseRequested(false)}>Continuer à préparer</button></div>}
      {realityMode && <p className="mt-3 rounded-xl bg-sky-50 p-3 text-sm">{realityMode === "DECLARE" ? "Vérifiez ce qui a réellement coûté et son financement, puis confirmez la réalisation." : "Corrigez les éléments et le financement de votre déclaration."} Pour un coût détaillé, corrigez les lignes ; aucun écart ne sera réparti automatiquement.</p>}
      {error && <div role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800"><p>{error}</p>{issue && <button type="button" className={secondary} onClick={repairServerIssue}>{issue.repairTarget === "reload" ? "Actualiser la liste, garder mon brouillon" : "Aller à la correction"}</button>}{issue?.repairTarget === "reload" && editedId && <button type="button" className={secondary} onClick={() => { const fresh = expenses.find((item) => item.id === editedId); if (fresh) start(fresh, realityMode); }}>Abandonner mon brouillon et reprendre la version affichée</button>}</div>}
      {step <= 4 && <PlannedIntentBuilder key={requestId} builder={builder} setBuilder={setBuilder} step={step} setStep={setStep} selectRoot={selectSubtype} persons={persons} places={places} wallets={wallets} prices={prices} vehicle={vehicle} targetMonth={targetMonth} busy={busy} onPreview={simulate} />}
      {step === 5 && !previewCurrent && <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm">L’aperçu précédent n’est plus à jour. <button type="button" className={secondary} onClick={() => setStep(4)}>Recalculer après modification</button></div>}
      {step === 5 && previewCurrent && preview && <div className="mt-4 grid gap-4"><PlannedImpactCard preview={preview} fundingIncomplete={readiness.issues.some((issue) => issue.code === "FUNDING_INCOMPLETE")} />
        <p className="text-xs text-slate-600">La simulation n’enregistre rien.</p><div className="flex flex-wrap gap-2"><button type="button" className={secondary} onClick={() => { setPreview(null); setStep(4); }}>Modifier</button><ContextualBlockerCTA purpose="SAVE" busy={busy} issues={readiness.issues} onClick={save} label={realityMode === "DECLARE" ? "Confirmer la réalisation" : realityMode === "CORRECT" ? "Enregistrer la déclaration corrigée" : editedId ? "Enregistrer la modification" : simulationMode ? "Ajouter réellement au mois" : "Ajouter au mois"} onRepair={(problem) => {
          const nextStep = problem.repairTarget === "builder-context" || problem.repairTarget === "builder-title" ? 3 : 4;
          setStep(nextStep); window.setTimeout(() => { const target = document.getElementById(problem.repairTarget) ?? document.getElementById(nextStep === 3 ? "builder-context" : "builder-cost"); target?.scrollIntoView({ behavior: "smooth", block: "center" }); target?.querySelector<HTMLElement>("input, select, button")?.focus(); }, 0);
        }} /></div></div>}
    </div>}
    <div className="mt-6 grid gap-5 lg:grid-cols-2"><div><h3 className="text-base font-black">À venir / prévues ({planned.length})</h3>{planned.length ? <ul className="mt-3 grid gap-3">{planned.map(card)}</ul> : <p className="mt-2 text-sm text-slate-600">Aucune dépense ajoutée pour l’instant.</p>}</div><div><h3 className="text-base font-black">Réalisées ce mois-ci ({realized.length})</h3>{realized.length ? <ul className="mt-3 grid gap-3">{realized.map(card)}</ul> : <p className="mt-2 text-sm text-slate-600">Aucune prévision marquée comme réalisée.</p>}</div></div>
    {(new Big(funding.swile.reserved).gt(0) || new Big(funding.edenred.reserved).gt(0) || new Big(funding.swile.usedDeclared).gt(0) || new Big(funding.edenred.usedDeclared).gt(0)) && <p className="mt-4 text-xs text-slate-600">Financement du mois : Swile {money(funding.swile.reserved)} réservés et {money(funding.swile.usedDeclared)} utilisés déclarés ; Edenred {money(funding.edenred.reserved)} réservés et {money(funding.edenred.usedDeclared)} utilisés déclarés. Aucun solde réel n’est débité.</p>}
  </section>;
}
