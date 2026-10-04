"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { OverlayFrame } from "@/ui/overlays/overlay-frame";
import { monthControlSection, monthWorkspaceFocus, monthControlUrl, replaceMonthControlOperation,
  type MonthControlSection, type MonthControlSectionInput, type MonthControlPurpose } from "@/domain/phase2/month-control-contract";
import type { MonthChoiceOperation } from "@/domain/phase2/month-choice-contract";
import { previewMonthControlCenter, applyMonthChoice, updateMonthControlInputs } from "./actions";
import { MonthControlSimulator } from "./month-control-simulator";
import { MonthControlSavings, MonthChoiceFocus } from "./month-control-choices";
import { MonthWorkspaceRoot, MonthPilotIndex, MonthPilotCategory, MonthInfoFacts } from "./month-control-workspace";
import { MonthUpdateSpatial } from "./month-update-spatial";
import { TargetFocus, AdjustmentFocus } from "./month-choice-editors";
import { MonthLocalFocusProvider } from "./month-control-focus";
import { controlMoney } from "@/domain/phase2/month-control-display";
import material from "./month-material.module.css";
import styles from "./month-control-center.module.css";

type Workbench = Awaited<ReturnType<typeof previewMonthControlCenter>>;
export type MonthControlModel = Workbench["model"];
type Destination = { section: MonthControlSectionInput; focus?: string };
const ControlContext = createContext<{ open: (destination: Destination, invoker?: HTMLElement) => void } | null>(null);
const button = `${material.clayButton} px-4 py-2 text-sm font-bold disabled:opacity-50`;

export function MonthControlLink({ section = "choices", focus, children, className, actionableCount }: Destination & {
  children?: ReactNode; className?: string; actionableCount?: number }) {
  const center = useContext(ControlContext);
  return <button type="button" data-month-control-trigger={children === undefined ? "" : undefined} className={`${className ?? button} ${children === undefined ? styles.controlTrigger : ""}`} onClick={event => center?.open({ section, focus }, event.currentTarget)}>
    {children ?? <><SlidersHorizontal size={16} className="mr-2 inline" aria-hidden="true" />Centre de contrôle</>}
  </button>;
}

export function MonthControlCenter({ model, initialSection = null, initialFocus = null, inputError = false, children }: {
  model: MonthControlModel; initialSection?: MonthControlSection | null; initialFocus?: string | null; inputError?: boolean;
  update?: ReactNode; understand?: ReactNode; children: ReactNode;
}) {
  const router = useRouter();
  const background = useRef<HTMLDivElement>(null), content = useRef<HTMLDivElement>(null), fallback = useRef<HTMLButtonElement>(null), invoker = useRef<HTMLElement>(null);
  const initial = monthWorkspaceFocus(initialSection ?? "choices", initialFocus);
  const [open, setOpen] = useState(initialSection !== null);
  const [focus, setFocus] = useState(initial === "info" ? null : initial), [info, setInfo] = useState(initial === "info");
  const section: MonthControlSection = focus?.startsWith("update") ? "update" : "choices";
  const infoRoot = useRef<HTMLDivElement>(null), infoButton = useRef<HTMLButtonElement>(null);
  const [refreshingDigest, setRefreshingDigest] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(inputError ? "Vérifiez la saisie du contrôle concerné." : null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 2800); return () => clearTimeout(timer); }, [toast]);
  const [purpose, setPurpose] = useState<MonthControlPurpose>(model.defaultPurpose), [operations, setOperations] = useState<readonly MonthChoiceOperation[]>([]);
  const [trial, setTrial] = useState<Workbench | null>(null), [pending, startTransition] = useTransition();
  const request = useRef(0), requested = useRef<string | null>(null), previousDigest = useRef(model.baseDigest);
  const updateLocation = useCallback((next: MonthControlSectionInput | null, nextFocus?: string | null) => {
    const url = new URL(window.location.href); url.searchParams.set("month", model.targetMonth);
    window.history.replaceState(null, "", monthControlUrl(url.href, next, nextFocus));
  }, [model.targetMonth]);
  const navigate = useCallback((destination: Destination, origin?: HTMLElement) => {
    if (origin) invoker.current = origin;
    const next = monthWorkspaceFocus(destination.section, destination.focus);
    setFocus(next === "info" ? null : next); setInfo(next === "info"); setOpen(true); updateLocation("center", next);
  }, [updateLocation]);
  const openEntity = (entity: string | null) => { const next = monthWorkspaceFocus("center", entity); setFocus(next); setInfo(false); updateLocation("center", next); };
  const close = () => { setOpen(false); setInfo(false); updateLocation(null); };
  useEffect(() => {
    if (!info || !open) return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setInfo(false); updateLocation("center", focus); infoButton.current?.focus(); } };
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !infoRoot.current?.contains(event.target)) { setInfo(false); updateLocation("center", focus); } };
    window.addEventListener("keydown", key, true); document.addEventListener("pointerdown", outside);
    return () => { window.removeEventListener("keydown", key, true); document.removeEventListener("pointerdown", outside); };
  }, [info, open, focus, updateLocation]);
  useEffect(() => { fallback.current = background.current?.querySelector<HTMLButtonElement>("[data-month-control-trigger]") ?? null; }, [model.targetMonth]);
  useEffect(() => {
    const restore = () => { const url = new URL(window.location.href), value = monthControlSection(url.searchParams.get("control"));
      setOpen(value !== null); if (value) { const next = monthWorkspaceFocus(url.searchParams.get("control") as MonthControlSectionInput, url.searchParams.get("focus")); setFocus(next === "info" ? null : next); setInfo(next === "info"); updateLocation("center", next); } };
    restore(); window.addEventListener("popstate", restore); return () => window.removeEventListener("popstate", restore);
  }, [model.targetMonth, updateLocation]);
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
    if (!open) return;
    if (!focus) { content.current?.scrollTo({ top: 0, behavior: "instant" }); return; }
    const frame = requestAnimationFrame(() => {
      const elements = content.current?.querySelectorAll<HTMLElement>("[data-local-focus],[data-control-focus]");
      const target = elements && [...elements].find(row => row.dataset.localFocus === focus || row.dataset.controlFocus === focus);
      content.current?.querySelectorAll<HTMLElement>("[data-control-highlight]").forEach(row => delete row.dataset.controlHighlight);
      if (!target) return;
      target.dataset.controlHighlight = "true";
      for (let parent = target.parentElement; parent && parent !== content.current; parent = parent.parentElement)
        if (parent instanceof HTMLDetailsElement) parent.open = true;
      if (target instanceof HTMLDetailsElement) target.open = true;
      target.scrollIntoView({ block: "start", behavior: "auto" });
      target.querySelector<HTMLElement>("input:not([type=hidden]),select,button,summary")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, section, focus]);
  const replaceDraft = (operation: MonthChoiceOperation) => {
    try { recalculate(replaceMonthControlOperation(operations, operation), { kind: "FREE_EXPLORATION" }); }
    catch { setMessage("Vérifiez cette réduction. Deux cibles différentes au maximum peuvent être simulées."); }
  };
  const activeTrial = trial?.baseDigest === model.baseDigest ? trial : null;
  const apply = () => {
    if (!activeTrial?.preview || pending || !activeTrial.applicable) return;
    startTransition(async () => {
      try { const result = await applyMonthChoice(model.targetMonth, { operations }, activeTrial.baseDigest);
        if (result.ok) { ++request.current; setOperations([]); setTrial(null); requested.current = null; setMessage(null); setToast("✓ Ajustements appliqués"); router.refresh(); }
        else { setMessage(result.message); setTrial(null); requested.current = null; router.refresh(); } }
      catch { setMessage("Ce scénario n’a pas été enregistré. Recalculez-le avant de réessayer."); setTrial(null); }
    });
  };
  const sendForm = (event: React.FormEvent<HTMLDivElement>) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.querySelector('input[name="intent"]') || !form.querySelector('input[name="targetMonth"]')) return;
    event.preventDefault(); event.stopPropagation(); if (pending) return;
    if (form.dataset.saveReady === "false") return;
    const data = new FormData(form);
    const triage = form.closest<HTMLElement>('[data-update-triage="true"]')?.dataset.updateItem;
    startTransition(async () => {
      try { const result = await updateMonthControlInputs(data);
        if (result.ok) { ++request.current; setTrial(null); requested.current = null; setMessage(null);
          const intent = String(data.get("intent"));
          setToast(intent.includes("target") || intent.includes("goal") ? "✓ Repère enregistré" : intent.includes("savings") ? intent.startsWith("add-") ? "✓ Cagnotte créée" : "✓ Cagnotte modifiée" : intent.includes("assumption") ? "✓ Ajustement enregistré" : "✓ Modification enregistrée");
          const after = triage ? `update:next:${triage}` : form.dataset.afterSave;
          if (triage) setRefreshingDigest(model.baseDigest);
          if (after) { const next = monthWorkspaceFocus("center", after); setFocus(next); updateLocation("center", next); }
          router.refresh(); }
        else { setMessage(result.message); form.querySelector<HTMLElement>("input:not([type=hidden]),select")?.focus(); } }
      catch { setMessage("Enregistrement impossible pour le moment. Votre saisie est conservée."); }
    });
  };
  const pilotCategory = model.categoryControls.find(row => focus === `pilot:category:${row.key}`);
  const targetCategory = model.categoryControls.find(row => focus === `pilot:target:${row.key}`);
  const adjustmentCategory = model.categoryControls.find(row => focus === `pilot:adjustment:${row.key}`);
  return <ControlContext.Provider value={{ open: navigate }}>
    <div ref={background}>{children}</div>
    <OverlayFrame open={open} kind="exploration" title={`Centre de contrôle — ${new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${model.targetMonth}-01T12:00:00Z`))}`}
      headerAside={<div className={styles.headerSummary} aria-label="Résumé du mois"><span>Fin de mois <strong>≈ {controlMoney(model.projectionSummary.economic?.central)}</strong></span><span>Objectif {model.settings.goal === null ? "—" : controlMoney(model.settings.goal)}</span><div ref={infoRoot} className={styles.infoAnchor}><button ref={infoButton} type="button" aria-label="État des données" aria-expanded={info} aria-controls="month-control-info" className={styles.infoButton} onClick={() => { setInfo(!info); updateLocation("center", !info ? "info" : focus); }}>ⓘ</button>{info && <section id="month-control-info" className={styles.infoPopover} aria-label="État des données"><MonthInfoFacts model={model} /></section>}</div></div>} className={`${material.page} ${styles.frame}`}
      closeAction={{ kind: "callback", onAction: close }} backgroundRootRef={background} restoreFocusRef={invoker} semanticFallbackRef={fallback} closeOnBackdrop>
      <div className={styles.layout}>
        <div ref={content} className={styles.content} data-control-content="" data-section={section} onSubmitCapture={sendForm}>
          {toast && <p role="status" className={styles.saveToast}>{toast}</p>}
          {message && <p role="status" className={styles.status}>{message}</p>}
          <MonthLocalFocusProvider value={{ section, entity: focus, openEntity }}>
          {section === "update" ? <MonthUpdateSpatial model={model} refreshing={refreshingDigest === model.baseDigest} /> : focus === "pilot" ? <MonthPilotIndex model={model} draftCount={operations.length} /> : focus === "savings" ? <MonthControlSavings model={model} />
            : pilotCategory ? <MonthPilotCategory key={pilotCategory.key} model={model} category={pilotCategory} trial={activeTrial} operations={operations} pending={pending} replaceDraft={replaceDraft} reset={() => recalculate(operations.filter(row => row.kind !== "CATEGORY" || row.categoryKey !== pilotCategory.key), { kind: "FREE_EXPLORATION" })} apply={apply} />
            : targetCategory ? <TargetFocus key={`${targetCategory.key}:${targetCategory.target}`} model={model} category={targetCategory} /> : adjustmentCategory ? <AdjustmentFocus key={adjustmentCategory.key} model={model} category={adjustmentCategory} />
            : focus === "pilot:review" ? <MonthControlSimulator model={model} trial={activeTrial} purpose={purpose} operations={operations} pending={pending} replaceDraft={replaceDraft} recalculate={recalculate} apply={apply} />
            : focus ? <MonthChoiceFocus model={model} /> : <MonthWorkspaceRoot model={model} draftCount={operations.length} />}
          </MonthLocalFocusProvider>
          {pending && <p role="status" className={styles.pendingNotice}>Recalcul en cours…</p>}
        </div>
      </div>
    </OverlayFrame>
  </ControlContext.Provider>;
}
