"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { OverlayFrame } from "@/ui/overlays/overlay-frame";
import { monthControlSection, monthControlUrl, replaceMonthControlOperation,
  type MonthControlSection, type MonthControlPurpose } from "@/domain/phase2/month-control-contract";
import type { MonthChoiceOperation } from "@/domain/phase2/month-choice-contract";
import { previewMonthControlCenter, applyMonthChoice, updateMonthControlInputs } from "./actions";
import { usePlannedExpenseInteractions } from "./planned-expense-interactions";
import { MonthControlObjectives, MonthControlSimulator } from "./month-control-simulator";
import { MonthControlOverview } from "./month-control-overview";
import { controlMoney } from "@/domain/phase2/month-control-display";
import material from "./month-material.module.css";
import styles from "./month-control-center.module.css";

type Workbench = Awaited<ReturnType<typeof previewMonthControlCenter>>;
export type MonthControlModel = Workbench["model"];
type Destination = { section: MonthControlSection; focus?: string };
const ControlContext = createContext<{ open: (destination: Destination, invoker?: HTMLElement) => void } | null>(null);
const sections = [["overview", "À piloter"], ["choices", "Objectifs & choix"], ["settings", "Hypothèses & exceptions"],
  ["resources", "Ressources & réserves"], ["reliability", "Données & fiabilité"]] as const;
const button = `${material.clayButton} px-4 py-2 text-sm font-bold disabled:opacity-50`;

export function MonthControlLink({ section = "overview", focus, children, className, actionableCount }: Destination & {
  children?: ReactNode; className?: string; actionableCount?: number }) {
  const center = useContext(ControlContext);
  return <button type="button" data-month-control-trigger={children === undefined ? "" : undefined} className={`${className ?? button} ${children === undefined ? styles.controlTrigger : ""}`} onClick={event => center?.open({ section, focus }, event.currentTarget)}>
    {children ?? <><SlidersHorizontal size={16} className="mr-2 inline" aria-hidden="true" />Centre de contrôle{actionableCount !== undefined && actionableCount > 0 && <span className={styles.notificationBadge} aria-label={`${actionableCount} éléments à vérifier`} title={`${actionableCount} éléments à vérifier`}>{actionableCount}</span>}</>}
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
      for (let parent = target.parentElement; parent && parent !== content.current; parent = parent.parentElement)
        if (parent instanceof HTMLDetailsElement) parent.open = true;
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
            onClick={() => navigate({ section: key })}>{label}{(key === "resources" && model.rootCauses.some(row => row.actionable && row.destination.section === key)) && <span className="ml-2 text-violet-600" aria-label="Informations à compléter">•</span>}</button>)}</nav>
        <div ref={content} className={styles.content} onSubmitCapture={sendForm}>
          <div className={styles.contextSummary} aria-label="Résumé du mois"><span>Reste prévu <strong>≈ {controlMoney(model.projectionSummary.economic?.central)}</strong></span><span>Objectif {model.settings.goal === null ? "—" : controlMoney(model.settings.goal)}</span><span>{model.rootCauses.filter(row => row.actionable).length} infos à compléter</span></div>
          {message && <p role="status" className={styles.status}>{message}</p>}
          {section === "overview" && <MonthControlOverview model={model} navigate={navigate} choosePurpose={choosePurpose} showProject={showProject} />}
          {section === "choices" && <div className="space-y-5"><h2 className="text-2xl font-black">Objectifs & choix</h2>
            <MonthControlObjectives model={model} choosePurpose={choosePurpose} />
            <MonthControlSimulator model={model} trial={activeTrial} purpose={purpose} operations={operations} pending={pending} replaceDraft={replaceDraft} recalculate={recalculate} apply={apply} />
          </div>}
          {section === "settings" && settings}{section === "resources" && resources}{section === "reliability" && reliability}
          {pending && <p role="status" className="mt-4 text-sm">Recalcul en cours…</p>}
        </div>
      </div>
    </OverlayFrame>
  </ControlContext.Provider>;
}
