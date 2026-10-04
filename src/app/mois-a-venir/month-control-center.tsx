"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, Check, ArrowRight, RotateCcw } from "lucide-react";
import { OverlayFrame } from "@/ui/overlays/overlay-frame";
import { monthControlSection, monthControlUrl, monthChoiceTarget, replaceMonthControlOperation,
  type MonthControlSection, type MonthControlPurpose } from "@/domain/phase2/month-control-contract";
import type { MonthChoiceOperation } from "@/domain/phase2/month-choice-contract";
import { previewMonthControlCenter, applyMonthChoice, updateMonthControlInputs } from "./actions";
import { usePlannedExpenseInteractions } from "./planned-expense-interactions";
import { CategoryTargetEditor, MonthGoalEditor } from "./month-decision-tools";
import material from "./month-material.module.css";
import styles from "./month-control-center.module.css";

type Workbench = Awaited<ReturnType<typeof previewMonthControlCenter>>;
export type MonthControlModel = Workbench["model"];
type Destination = { section: MonthControlSection; focus?: string };
const ControlContext = createContext<{ open: (destination: Destination, invoker?: HTMLElement) => void } | null>(null);
const sections = [["overview", "À piloter"], ["choices", "Objectifs & choix"], ["settings", "Réglages du mois"],
  ["resources", "Ressources & réserves"], ["reliability", "Fiabilité"]] as const;
const money = (value: string | null | undefined) => value == null ? "À confirmer" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(Number(value));
const button = `${material.clayButton} px-4 py-2 text-sm font-bold disabled:opacity-50`;

export function MonthControlLink({ section = "overview", focus, children, className, actionableCount }: Destination & {
  children?: ReactNode; className?: string; actionableCount?: number }) {
  const center = useContext(ControlContext);
  return <button type="button" data-month-control-trigger={children === undefined ? "" : undefined} className={className ?? button} onClick={event => center?.open({ section, focus }, event.currentTarget)}>
    {children ?? <><SlidersHorizontal size={16} className="mr-2 inline" aria-hidden="true" />Centre de contrôle{actionableCount === undefined ? "" : actionableCount > 0 ? ` · ${actionableCount}` : " ✓"}</>}
  </button>;
}

export function MonthControlCenter({ model, initialSection = null, initialFocus = null, inputError = false, resources, settings, reliability, children }: {
  model: MonthControlModel; initialSection?: MonthControlSection | null; initialFocus?: string | null; inputError?: boolean;
  resources: ReactNode; settings: ReactNode; reliability: ReactNode; children: ReactNode;
}) {
  const router = useRouter(), interactions = usePlannedExpenseInteractions();
  const background = useRef<HTMLDivElement>(null), content = useRef<HTMLDivElement>(null), fallback = useRef<HTMLButtonElement>(null), invoker = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(initialSection !== null), [section, setSection] = useState<MonthControlSection>(initialSection ?? "overview");
  const [focus, setFocus] = useState(initialFocus), [message, setMessage] = useState<string | null>(inputError ? "Vérifiez la saisie du contrôle concerné." : null);
  const [purpose, setPurpose] = useState<MonthControlPurpose>(model.defaultPurpose), [operations, setOperations] = useState<readonly MonthChoiceOperation[]>([]);
  const [trial, setTrial] = useState<Workbench | null>(null), [pending, startTransition] = useTransition();
  const request = useRef(0), requested = useRef<string | null>(null), previousDigest = useRef(model.baseDigest);
  const updateLocation = useCallback((next: MonthControlSection | null, nextFocus?: string | null) => {
    const url = new URL(window.location.href); url.searchParams.set("month", model.targetMonth);
    window.history.replaceState(null, "", monthControlUrl(url.href, next, nextFocus));
  }, [model.targetMonth]);
  const navigate = useCallback((destination: Destination, origin?: HTMLElement) => {
    if (origin) invoker.current = origin;
    setSection(destination.section); setFocus(destination.focus ?? null); setOpen(true); updateLocation(destination.section, destination.focus);
  }, [updateLocation]);
  const close = () => { setOpen(false); updateLocation(null); };
  useEffect(() => { fallback.current = background.current?.querySelector<HTMLButtonElement>("[data-month-control-trigger]") ?? null; }, [model.targetMonth]);
  useEffect(() => {
    const restore = () => { const url = new URL(window.location.href), value = monthControlSection(url.searchParams.get("control"));
      setOpen(value !== null); if (value) { setSection(value); setFocus(url.searchParams.get("focus")); } };
    restore(); window.addEventListener("popstate", restore); return () => window.removeEventListener("popstate", restore);
  }, [model.targetMonth]);
  useEffect(() => {
    if (previousDigest.current === model.baseDigest) return;
    previousDigest.current = model.baseDigest; ++request.current; requested.current = null; setTrial(null);
    if (operations.length) setMessage("Le mois a changé. Recalculez le scénario puis validez à nouveau ses conséquences.");
    else setPurpose(model.defaultPurpose);
  }, [model.baseDigest, model.defaultPurpose, operations.length]);
  const recalculate = useCallback((nextOperations: readonly MonthChoiceOperation[], nextPurpose: MonthControlPurpose) => {
    const sequence = ++request.current;
    requested.current = JSON.stringify([model.baseDigest, nextPurpose, nextOperations]);
    setOperations(nextOperations); setPurpose(nextPurpose); setTrial(null);
    startTransition(async () => {
      try { const result = await previewMonthControlCenter(model.targetMonth, nextPurpose, nextOperations);
        if (sequence === request.current) { setTrial(result); setMessage(null); if (result.baseDigest !== model.baseDigest) router.refresh(); } }
      catch { if (sequence === request.current) setMessage("Le scénario ne peut pas encore être calculé. Vérifiez ses choix ou réinitialisez-le ; le mois enregistré reste inchangé."); }
    });
  }, [model.baseDigest, model.targetMonth, router]);
  useEffect(() => {
    if (!open || section !== "choices" || operations.length || !model.editable) return;
    const key = JSON.stringify([model.baseDigest, purpose, operations]);
    if (requested.current !== key) recalculate(operations, purpose);
  }, [open, section, operations, purpose, recalculate, model.baseDigest, model.editable]);
  useEffect(() => {
    if (!open || !focus) return;
    const frame = requestAnimationFrame(() => {
      const elements = content.current?.querySelectorAll<HTMLElement>("[data-control-focus]");
      const target = elements && [...elements].find(row => row.dataset.controlFocus === focus);
      content.current?.querySelectorAll<HTMLElement>("[data-control-highlight]").forEach(row => delete row.dataset.controlHighlight);
      if (!target) return;
      target.dataset.controlHighlight = "true";
      if (target instanceof HTMLDetailsElement) target.open = true;
      target.querySelectorAll<HTMLDetailsElement>("details").forEach(row => { row.open = true; });
      target.scrollIntoView({ block: "start", behavior: "auto" });
      target.querySelector<HTMLElement>("input:not([type=hidden]),select,button,summary")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, section, focus]);
  const choosePurpose = (next: MonthControlPurpose) => { navigate({ section: "choices", focus: "categoryKey" in next ? next.categoryKey : "global-goal" }); recalculate(operations, next); };
  const replaceDraft = (operation: MonthChoiceOperation) => {
    try { recalculate(replaceMonthControlOperation(operations, operation), purpose); }
    catch { setMessage("Vérifiez cette réduction. Deux cibles différentes au maximum peuvent être simulées."); }
  };
  const activeTrial = trial?.baseDigest === model.baseDigest ? trial : null;
  const apply = () => {
    if (!activeTrial?.preview || pending || !activeTrial.applicable) return;
    startTransition(async () => {
      try { const result = await applyMonthChoice(model.targetMonth, { operations }, activeTrial.baseDigest);
        if (result.ok) { ++request.current; setOperations([]); setTrial(null); requested.current = null; setMessage(result.message); router.refresh(); }
        else { setMessage(result.message); setTrial(null); requested.current = null; router.refresh(); } }
      catch { setMessage("Ce scénario n’a pas été enregistré. Recalculez-le avant de réessayer."); setTrial(null); }
    });
  };
  const sendForm = (event: React.FormEvent<HTMLDivElement>) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.querySelector('input[name="intent"]') || !form.querySelector('input[name="targetMonth"]')) return;
    event.preventDefault(); event.stopPropagation(); if (pending) return;
    const data = new FormData(form), target = form.closest<HTMLElement>("[data-control-focus]")?.dataset.controlFocus;
    if (target) { setFocus(target); updateLocation(section, target); }
    startTransition(async () => {
      try { const result = await updateMonthControlInputs(data); setMessage(result.message);
        if (result.ok) { ++request.current; setTrial(null); requested.current = null; router.refresh(); }
        else form.querySelector<HTMLElement>("input:not([type=hidden]),select")?.focus(); }
      catch { setMessage("Enregistrement impossible pour le moment. Votre saisie est conservée."); }
    });
  };
  const showProject = (id: string) => { close(); interactions?.request({ action: "EDIT", id }); };
  return <ControlContext.Provider value={{ open: navigate }}>
    <div ref={background}>{children}</div>
    <OverlayFrame open={open} kind="exploration" title={`Centre de contrôle — ${new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${model.targetMonth}-01T12:00:00Z`))}`}
      subtitle="Comprendre, décider et comparer les conséquences pour ce mois" className={`${material.page} ${styles.frame}`}
      closeAction={{ kind: "callback", onAction: close }} backgroundRootRef={background} restoreFocusRef={invoker} semanticFallbackRef={fallback} closeOnBackdrop>
      <div className={styles.layout}>
        <nav aria-label="Zones du centre de contrôle" className={styles.sidebar}>{sections.map(([key, label]) =>
          <button key={key} className={styles.tab} aria-current={section === key ? "page" : undefined}
            onClick={() => navigate({ section: key })}>{label}</button>)}</nav>
        <div ref={content} className={styles.content} onSubmitCapture={sendForm}>
          {message && <p role="status" className={styles.status}>{message}</p>}
          {section === "overview" && <div className="space-y-5">
            <header><p className="text-xs font-bold uppercase text-violet-700">À piloter</p><h2 className="mt-2 text-2xl font-black">{model.headline}</h2>
              <p className="mt-3 text-sm">Projection économique centrale : <strong>≈ {money(model.projectionSummary.economic?.central)}</strong>.</p>
              {model.projectionSummary.globalSatisfied && <p className="mt-2 text-sm text-emerald-900">Votre objectif global reste respecté avec environ {money(model.projectionSummary.globalDelta)} de marge.</p>}</header>
            <section><h3 className="font-bold">{model.tensions.length} point{model.tensions.length !== 1 ? "s" : ""} à décider</h3>
              <ul className="mt-3 space-y-3">{model.tensions.map(row => <li key={row.key} className={`${material.dataCard} p-4`}><p className="font-bold">{row.label}</p><p className="mt-1 text-sm">{row.explanation}</p>
                <button className={`${button} mt-2`} onClick={() => choosePurpose(row.kind === "GLOBAL_GOAL" ? { kind: "GLOBAL_GOAL" } : { kind: "CATEGORY_CORRECTION", categoryKey: row.categoryKey })}>{row.kind === "GLOBAL_GOAL" ? "Explorer des ajustements" : row.alreadyOver ? "Limiter le reste du mois" : `Corriger ${row.label}`}</button>
                {row.kind === "CATEGORY_TARGET" && <button className="ml-3 text-xs font-bold underline" onClick={() => choosePurpose({ kind: "CATEGORY_OVERAGE_OFFSET", categoryKey: row.categoryKey })}>Compenser ailleurs</button>}</li>)}</ul></section>
            <section><h3 className="font-bold">Informations déclarées</h3><ul className="mt-2 space-y-1 text-sm">{model.observations.map(row => <li key={row.key}>{row.label} : {money(row.amount)}{row.date && ` au ${row.date}`}</li>)}</ul></section>
            <section><h3 className="font-bold">Points à préciser</h3><ul className="mt-3 space-y-3">{model.rootCauses.map(row => <li key={row.key} className={`${material.glassSoft} p-4`}>
              <p className="font-bold">{row.label}</p><p className="mt-1 text-sm">{row.explanation}</p><p className="mt-2 text-xs text-slate-600">{row.symptoms.join(" · ")}</p>
              <button className={`${button} mt-2`} onClick={() => row.projectId ? showProject(row.projectId) : navigate(row.destination)}>{row.projectId ? "Voir le projet" : row.actionable ? "Préciser" : "Comprendre"}<ArrowRight className="ml-2 inline" size={14} aria-hidden="true" /></button>
            </li>)}</ul></section>
            {[ ["Intentions", model.activeIntentions], ["Décisions déjà actives", model.activeDecisions], ["Réservations", model.reservations] ].map(([label, rows]) => <section key={String(label)}><h3 className="font-bold">{String(label)}</h3>
              <ul className="mt-2 space-y-2">{(rows as MonthControlModel["activeDecisions"]).map(row => <li key={row.key} className="flex items-center justify-between gap-4 text-sm"><span>{row.label} · {row.value}</span><button className="font-bold underline" onClick={() => navigate(row.destination)}>Gérer</button></li>)}</ul></section>)}
          </div>}
          {section === "choices" && <div className="space-y-5">
            <header><h2 className="text-2xl font-black">Objectifs & choix</h2><p className="mt-2 text-sm text-slate-600">Un objectif est un repère. Seule l’application d’un scénario modifie une hypothèse du mois.</p></header>
            <div className="grid grid-cols-2 gap-4">{model.categoryControls.map(row => <article data-control-focus={row.key} key={row.key} className={`${material.dataCard} p-4`}>
              <h3 className="font-bold">{row.label}</h3><CategoryTargetEditor control={row} targetMonth={model.targetMonth} />
              {row.target !== null && row.varianceToTarget !== null && Number(row.varianceToTarget) > 0 && <div className="mt-3 flex gap-3 text-xs"><button className="font-bold underline" onClick={() => choosePurpose({ kind: "CATEGORY_CORRECTION", categoryKey: row.key })}>Corriger ce poste</button><button className="font-bold underline" onClick={() => choosePurpose({ kind: "CATEGORY_OVERAGE_OFFSET", categoryKey: row.key })}>Compenser ailleurs</button></div>}
            </article>)}</div>
            <div data-control-focus="global-goal"><MonthGoalEditor targetMonth={model.targetMonth} settings={model.settings} goal={model.projectionSummary} /></div>
            <section className={`${material.glassPremium} p-5`} aria-labelledby="workbench-title"><h3 id="workbench-title" className="text-xl font-black">Scénario en cours · {operations.length}/2 décisions</h3>
              <p className="mt-2 text-sm">{activeTrial?.offerContext ?? "Testez des choix puis comparez l’état enregistré à leurs conséquences."}</p>
              {purpose.kind === "NONE" && !model.projectionSummary.economic && <p className="mt-3 text-sm">Complétez les ressources avant de simuler des ajustements économiques.</p>}
              {purpose.kind === "NONE" && model.projectionSummary.economic && <><p className="mt-3 text-sm">Aucun ajustement nécessaire selon vos objectifs actuels.</p><button className="mt-2 text-xs font-bold underline" onClick={() => recalculate(operations, { kind: "FREE_EXPLORATION" })}>Explorer quand même d’autres scénarios</button></>}
              {activeTrial?.resolved && <p role="status" className="mt-3 font-bold text-emerald-900"><Check className="mr-1 inline" size={18} aria-hidden="true" />{purpose.kind === "GLOBAL_GOAL" ? "Objectif de fin de mois atteint dans ce scénario" : purpose.kind === "CATEGORY_CORRECTION" ? "Objectif de catégorie atteint dans ce scénario" : "Marge recherchée compensée ; le repère de catégorie reste distinct"}</p>}
              {operations.length > 0 && <ul className="mt-4 space-y-3">{operations.map(op => {
                const row = activeTrial?.selected.find(row => row.target === monthChoiceTarget(op));
                return <li key={monthChoiceTarget(op)} className={`${material.dataCard} p-3`}><div className="flex justify-between gap-3"><span className="text-sm font-bold">{row?.label ?? "Choix sélectionné"}{row && ` · ${money(row.before)} → ${money(row.after)}`}</span>
                  <button className="text-xs font-bold underline" disabled={pending} onClick={() => recalculate(operations.filter(other => monthChoiceTarget(other) !== monthChoiceTarget(op)), purpose)}>Retirer</button></div>
                  <details className="mt-2 text-xs"><summary className="cursor-pointer">Remplacer cette réduction</summary><form className="mt-2 flex items-end gap-2" onSubmit={event => {
                    event.preventDefault(); const data = new FormData(event.currentTarget), amount = String(data.get("reduction"));
                    replaceDraft(op.kind === "CATEGORY" ? { kind: "CATEGORY", categoryKey: op.categoryKey, strategy: "REDUCE_AMOUNT", amount } : { ...op, amount });
                  }}><label>Réduction en € depuis l’état enregistré<input className={`${material.field} ml-2 w-28 px-2 py-1`} name="reduction" type="number" min="0" step="0.01" required /></label><button className={button} disabled={pending}>Remplacer</button></form></details>
                </li>;
              })}</ul>}
              {operations.length === 2 && <p className="mt-3 text-xs text-slate-600">Deux décisions maximum. Retirez un choix pour ajouter une autre cible.</p>}
              {activeTrial?.preview && <>
                <table className={`${styles.compare} mt-5`} aria-label="Comparaison état enregistré et scénario"><thead><tr><th>Repère</th><th>Actuel</th><th>Scénario</th></tr></thead><tbody>
                  <tr><th>Projection économique de fin de mois</th><td>{money(activeTrial.model.projectionSummary.economic?.central)}</td><td>{money(activeTrial.scenario.projectionSummary.economic?.central)}</td></tr>
                  {model.settings.goal !== null && <tr><th>Écart à l’objectif global</th><td>{money(activeTrial.model.projectionSummary.globalDelta)}</td><td>{money(activeTrial.scenario.projectionSummary.globalDelta)}</td></tr>}
                  <tr><th>Dépassements de catégories</th><td>{money(activeTrial.model.projectionSummary.categoryGap)}</td><td>{money(activeTrial.scenario.projectionSummary.categoryGap)}</td></tr>
                  <tr><th>Cagnottes protégées</th><td>{money(activeTrial.model.projectionSummary.protectedSavings)}</td><td>{money(activeTrial.scenario.projectionSummary.protectedSavings)}</td></tr>
                </tbody></table>
                <p className="mt-3 font-bold">≈ {money(activeTrial.budgetMarginGain)} de marge supplémentaire</p>
                <p className="mt-1 text-sm">≈ {money(activeTrial.spendingReduction)} de consommation prévue évitée · {money(activeTrial.reservationRelease)} de réservation libérée.</p>
                {purpose.kind !== "FREE_EXPLORATION" && purpose.kind !== "NONE" && <p className="mt-2 text-sm">Reste ≈ {money(activeTrial.remainingNeed)} {purpose.kind === "CATEGORY_CORRECTION" ? "au-dessus de ce repère de catégorie" : "à couvrir pour ce scénario"}.</p>}
                <details className="mt-3 text-xs"><summary className="cursor-pointer font-bold">Limites de la simulation</summary><ul className="mt-2 space-y-1">{activeTrial.preview.limitations.map(note => <li key={note}>{note}</li>)}</ul></details>
              </>}
              {!activeTrial && operations.length > 0 && <button className={`${button} mt-4`} disabled={pending} onClick={() => recalculate(operations, purpose)}>Recalculer le scénario</button>}
              <div className="mt-5 grid grid-cols-2 gap-3">{activeTrial?.offers.map(offer => <button key={offer.id} className={`${material.clayChip} p-4 text-left text-sm disabled:opacity-50`} disabled={pending || !activeTrial.canAdd}
                onClick={() => replaceDraft(offer.operation)}><strong>{offer.label}</strong><span className="mt-1 block text-xs">{offer.reason}</span>
                <span className="mt-2 block font-bold">≈ {money(offer.preview.delta)} de marge{offer.remainingNeedAfter !== null && ` · reste ≈ ${money(offer.remainingNeedAfter)}`}</span></button>)}</div>
              {activeTrial && !activeTrial.resolved && !activeTrial.offers.length && purpose.kind !== "NONE" && operations.length < 2 && <p className="mt-3 text-sm">Aucun autre levier chiffrable disponible pour ce but. Vous pouvez modifier le choix sélectionné ou votre repère.</p>}
              <div className="mt-5 flex items-center gap-4"><button className={`${material.clayPrimary} px-5 py-3 text-sm font-bold disabled:opacity-50`} disabled={pending || !activeTrial?.applicable || !operations.length} onClick={apply}>Appliquer ce scénario au mois</button>
                <button className="text-xs font-bold underline" disabled={pending} onClick={() => recalculate([], model.defaultPurpose)}><RotateCcw className="mr-1 inline" size={14} aria-hidden="true" />Réinitialiser le scénario</button></div>
              <p className="mt-2 text-xs text-slate-600">La simulation est temporaire. L’application change uniquement les inputs prospectifs du mois.</p>
            </section>
          </div>}
          {section === "settings" && settings}{section === "resources" && resources}{section === "reliability" && reliability}
          {pending && <p role="status" className="mt-4 text-sm">Recalcul en cours…</p>}
        </div>
      </div>
    </OverlayFrame>
  </ControlContext.Provider>;
}
