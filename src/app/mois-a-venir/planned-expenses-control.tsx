"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ArrowLeft, CalendarDays, Trash2, X } from "lucide-react";
import { PLANNED_FAMILIES, PLANNED_SUBTYPE_LABELS, type PlannedExpenseFamily } from "@/domain/phase2/planned-assets";
import { createBuilderState, changeBuilderRoot, deriveBuilderReadiness, materializeBuilderDraft, synchronizeIntentBuilder, adoptBuilderResolvedTransport } from "@/domain/phase2/planned-builder";
import { BUILDER_INTENTS } from "@/domain/phase2/planned-ux";
import type { PlannedPlaceOption } from "@/domain/phase2/planned-places";
import type { PlannedPriceSuggestion, PlannedVehicleEstimate, PlannedWalletOption } from "@/domain/phase2/planned-contract";
import { ContextualProjectWizard, ProjectIntentHub } from "./contextual-project-wizard";
import { backWizard, beginProjectV2, emptyWizardSession, jumpWizard, projectHasSignificantDraft } from "@/domain/phase2/planned-question-engine";
import { ContextualBlockerCTA } from "./planned-builder-primitives";
import type { PlannedExpenseCard } from "./planned-expenses-projection";
import { confirmPlannedExpenseReality, restorePlannedExpenseAction, reportPlannedExpenseAction,
  previewPlannedExpense, removePlannedExpense, savePlannedExpense } from "./planned-expenses-actions";
import { type PlannedIssue, type PlannedResult, type RealityConfirmationDraft } from "@/domain/phase2/planned-mutations";
import { PlannedImpactCard } from "./planned-impact-card";
import { usePlannedExpenseInteractions } from "./planned-expense-interactions";
import { calendarExpenseActions } from "./calendar-presentation";
import { RestaurantPhotoBackground } from "./restaurant-photo-background";
import { PlannedBuilderFrame, type BuilderReturnPoint } from "./planned-wizard-visuals";
import wizardStyles from "./planned-wizard.module.css";
import projectStyles from "./project-wizard.module.css";

type Person = { personId: string; displayName: string; isCurrentUser?: boolean };
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
  const [repairRequest, setRepairRequest] = useState({ target: "", serial: 0 });
  const [wizardSession, setWizardSession] = useState(emptyWizardSession);
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
  const returnPoint = useRef<BuilderReturnPoint | null>(null);
  const currentRevision = useRef(builder.revision);
  currentRevision.current = builder.revision;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewRevision, setPreviewRevision] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const isWorkMeal = draft.familyKey === "food" && draft.subtypeKey === "work_meal";
  const restaurantFlow = false; // All nine entry points now use the shared question engine.
  const wizardEnv = { persons, places, editedId, linkedProjects: expenses.map(item => ({ id: item.id, draft: item, status: item.status })) };
  const dismiss = () => { if (closeRequested) setCloseRequested(false); else if (editedId || projectHasSignificantDraft(builder, wizardSession)) setCloseRequested(true); else setOpen(false); };
  const repairDraft = (target: string) => {
    setRepairRequest((request) => ({ target, serial: request.serial + 1 })); setStep(4);
  };
  const contextPersonLabel = persons.find((person) => person.personId === draft.context.participantPersonIds?.[0])?.displayName;
  const readiness = deriveBuilderReadiness(builder, { places, workMealPersonName: isWorkMeal ? contextPersonLabel : undefined });
  const canPreview = readiness.previewReady;
  const previewCurrent = preview !== null && previewRevision === builder.revision && preview.targetMonth === targetMonth;

  const resetPreview = () => { setPreview(null); setError(""); setIssue(null); };
  const start = (item?: PlannedExpenseCard, mode: "DECLARE" | "CORRECT" | null = null, plannedDate?: string) => {
    setSimulationMode(false);
    if (inFlight.current) return;
    if (!open) returnPoint.current = { focus: document.activeElement as HTMLElement | null, left: window.scrollX, top: window.scrollY };
    draftSession.current++;
    const next = item ? { familyKey: item.familyKey, subtypeKey: item.subtypeKey, title: item.title,
      plannedDate: item.plannedDate, costItems: item.costItems.map((cost) => ({ ...cost })), context: { ...item.context } } : { ...emptyDraft(), plannedDate: plannedDate ?? null };
    setBuilder(item ? beginProjectV2(createBuilderState(next), { persons, places }) : createBuilderState(next));
    setWizardSession(item ? jumpWizard(emptyWizardSession(), "review") : emptyWizardSession());
    setRequestId(item?.id ?? crypto.randomUUID()); setExpectedUpdatedAt(item?.updatedAt); setRealityMode(mode);
    setIssue(null); setNotice(""); setReportId(null); setDeleteId(null);
    setCloseRequested(false);
    setRepairRequest({ target: "", serial: 0 });
    setEditedId(item?.id); setPreview(null); setPreviewRevision(null); setError(""); setStep(item ? 3 : 1); setOpen(true);
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
      return beginProjectV2(hasExplicit ? changeBuilderRoot(state, nextDraft) : { ...createBuilderState(nextDraft), revision: state.revision + 1 }, { persons, places });
    });
    setWizardSession(emptyWizardSession());
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
    repairDraft(issue.repairTarget);
  };

  useEffect(() => {
    const pending = interactions?.pending;
    if (!pending) return;
    interactions.consume();
    if (pending.action === "CREATE" || pending.action === "SIMULATE") {
      if (inFlight.current || open && builder.revision > 0) {
        setError("Terminez ou fermez le brouillon ouvert avant de prévoir autre chose.");
      }
      else {
        start(undefined, null, pending.action === "CREATE" ? pending.plannedDate : undefined);
        setSimulationMode(pending.action === "SIMULATE");
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
    if (pending.action === "REPORT" || pending.action === "DELETE") window.setTimeout(() => {
      const target = document.getElementById(`project-${item.id}`) as HTMLDetailsElement | null;
      if (target) { target.open = true; target.scrollIntoView({ behavior: "smooth", block: "center" }); target.querySelector<HTMLElement>("button, input")?.focus({ preventScroll: true }); }
    }, 0);
    // Pending is a consumed navigation command, never a second draft authority.
  }, [interactions?.pending]);

  const card = (item: PlannedExpenseCard) => <li key={item.id} className="rounded-xl border border-slate-200 bg-white px-4">
      {item.familyKey === "food" && item.subtypeKey === "restaurant" && <RestaurantPhotoBackground placeId={item.context.restaurant?.googlePlaceId} />}
    <details id={`project-${item.id}`} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-4 py-4 focus-visible:outline-2 focus-visible:outline-emerald-700 [&::-webkit-details-marker]:hidden">
        <h3 className="min-w-0 flex-1 font-bold">{item.title}</h3>
        <span className={`rounded-full px-2 py-1 text-xs ${item.status === "DECLARED_REALIZED" ? "bg-emerald-50 text-emerald-800" : item.needsRealityConfirmation ? "bg-amber-50 text-amber-900" : "text-slate-500"}`}>{item.status === "DECLARED_REALIZED" ? "Réalisée · déclarée" : item.needsRealityConfirmation ? "À confirmer" : "Prévue"}</span>
        <span className="w-32 text-right text-sm text-slate-500"><CalendarDays size={13} className="mr-1 inline" aria-hidden="true" />{item.plannedDate ? dateLabel(item.plannedDate) : "Sans date précise"}</span>
        <strong className="w-24 text-right tabular-nums">{item.context.project?.unpricedComponents?.length ? Number(item.grossCost) === 0 ? "À préciser" : `≥ ${money(item.grossCost)}` : money(item.grossCost)}</strong>
      </summary>
      <p className="text-xs text-slate-600">{item.costItems.map((cost) => `${cost.variantLabel || cost.label} · ${cost.quantity} × ${money(cost.unitAmount)}`).join(" · ")}</p>
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
    </details>
  </li>;

  return <>
    {notice && <p role="status" className="mt-3 rounded-xl bg-emerald-100 p-3 text-sm">{notice}</p>}
    {error && !open && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}{issue?.repairTarget === "reload" && <button className={secondary} onClick={() => router.refresh()}>Recharger la liste</button>}{issue?.repairTarget === "month" && reportDate && <a className="ml-2 underline" href={`/mois-a-venir?month=${reportDate.slice(0, 7)}`}>Préparer les ressources de ce mois</a>}</p>}
    {expenses.length > 0 && <section aria-labelledby="planned-expense-title" className="scroll-mt-24"><h2 id="planned-expense-title" className="scroll-mt-24 text-2xl font-black">Nos projets</h2><ul className="mt-4 space-y-2">{expenses.map(card)}</ul></section>}
    {open && <PlannedBuilderFrame immersive returnPoint={returnPoint.current} label={realityMode ? "Confirmer une dépense réalisée" : "Préparer une dépense"} onDismiss={dismiss}>
      <div className={projectStyles.header}><h3>{step === 1 ? "Ajouter une dépense" : draft.title}</h3><nav className={projectStyles.topNav} aria-label="Navigation du brouillon"><button type="button" disabled={step === 1 || busy} onClick={() => {
        if (step === 5) { setStep(3); setWizardSession(s => jumpWizard(s, "review")); }
        else if (wizardSession.history.length) setWizardSession(backWizard);
        else setStep(1);
      }}><ArrowLeft size={14} className="mr-1 inline" aria-hidden="true" />Retour</button><button type="button" aria-label="Fermer le brouillon" onClick={dismiss}><X size={18} aria-hidden="true" /></button></nav></div>
      {closeRequested && <div className={projectStyles.dialogBackdrop}><div role="alertdialog" aria-modal="true" aria-labelledby="project-exit-title" className={projectStyles.dialog}><h4 id="project-exit-title">Quitter ce brouillon ?</h4><div className={projectStyles.editorActions}><button autoFocus type="button" className={projectStyles.primary} onClick={() => setCloseRequested(false)}>Continuer</button><button type="button" className={projectStyles.textButton} onClick={() => { setOpen(false); setPreview(null); setCloseRequested(false); }}>Quitter</button></div></div></div>}
      {realityMode && <p className="mt-3 rounded-xl bg-sky-50 p-3 text-sm">{realityMode === "DECLARE" ? "Vérifiez ce qui a réellement coûté et son financement, puis confirmez la réalisation." : "Corrigez les éléments et le financement de votre déclaration."} Pour un coût détaillé, corrigez les lignes ; aucun écart ne sera réparti automatiquement.</p>}
      {error && <div role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800"><p>{error}</p>{issue && <button type="button" className={secondary} onClick={repairServerIssue}>{issue.repairTarget === "reload" ? "Actualiser la liste, garder mon brouillon" : "Aller à la correction"}</button>}{issue?.repairTarget === "reload" && editedId && <button type="button" className={secondary} onClick={() => { const fresh = expenses.find((item) => item.id === editedId); if (fresh) start(fresh, realityMode); }}>Abandonner mon brouillon et reprendre la version affichée</button>}</div>}
      <div className={wizardStyles.body}>
      {step === 1 && <ProjectIntentHub onChoose={key => { const intent = BUILDER_INTENTS.find(i => i.key === key)!; selectSubtype(intent.family, intent.subtype ?? (key === "party" ? "bar" : key === "activity" ? "other_activity" : "other_purchase")); }} />}
      {step > 1 && step <= 4 && <ContextualProjectWizard key={requestId} builder={builder} setBuilder={setBuilder} session={wizardSession} setSession={setWizardSession} env={wizardEnv} wallets={wallets} prices={prices} targetMonth={targetMonth} busy={busy} onPreview={simulate} repairRequest={repairRequest} />}
      {step === 5 && !previewCurrent && <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm">L’aperçu précédent n’est plus à jour. <button type="button" className={secondary} onClick={() => setStep(4)}>Recalculer après modification</button></div>}
      {step === 5 && previewCurrent && preview && <div className={projectStyles.preview}><PlannedImpactCard preview={preview} fundingIncomplete={readiness.issues.some((issue) => issue.code === "FUNDING_INCOMPLETE")} />
        <div className={projectStyles.previewActions}><button type="button" className={projectStyles.textButton} onClick={() => { setPreview(null); setStep(3); setWizardSession(s => jumpWizard(s, "review")); }}>Modifier</button><ContextualBlockerCTA purpose="SAVE" busy={busy} issues={readiness.issues} onClick={save} label={realityMode === "DECLARE" ? "Confirmer la réalisation" : realityMode === "CORRECT" ? "Enregistrer la déclaration corrigée" : editedId ? "Enregistrer la modification" : simulationMode ? "Ajouter réellement au mois" : "Ajouter au mois"} onRepair={(problem) => repairDraft(problem.repairTarget)} /></div></div>}
      </div>
    </PlannedBuilderFrame>}
  </>;
}
