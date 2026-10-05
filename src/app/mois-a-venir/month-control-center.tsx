"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, Info } from "lucide-react";
import { OverlayFrame } from "@/ui/overlays/overlay-frame";
import { monthControlSection, monthWorkspaceFocus, monthControlUrl, replaceMonthControlOperation, parseMonthControlDraft, parseMonthControlPurpose,
  type MonthControlSection, type MonthControlSectionInput, type MonthControlPurpose } from "@/domain/phase2/month-control-contract";
import type { MonthChoiceOperation } from "@/domain/phase2/month-choice-contract";
import { previewMonthControlCenter, applyMonthChoice, undoMonthChoice, updateMonthControlInputs } from "./actions";
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
  const [undoToken, setUndoToken] = useState<string | null>(null);
  const undoSessionKey = `month-control:${model.reliability.publicationId}:${model.targetMonth}:undo`;
  const clearUndoSession = () => { try { sessionStorage.removeItem(undoSessionKey); } catch { /* Session storage may be disabled. */ } };
  const lastFocus = useRef<string | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<MonthControlPurpose>(model.defaultPurpose), [operations, setOperations] = useState<readonly MonthChoiceOperation[]>([]);
  const draftSessionKey = `month-control:${model.reliability.publicationId}:${model.targetMonth}:draft`;
  const [sessionReady, setSessionReady] = useState(false);
  useEffect(() => {
    try { const saved = JSON.parse(sessionStorage.getItem(draftSessionKey) ?? "null");
      if (saved && saved.expires > Date.now()) { setOperations(parseMonthControlDraft(saved.operations)); setPurpose(parseMonthControlPurpose(saved.purpose)); }
      else sessionStorage.removeItem(draftSessionKey);
    } catch { try { sessionStorage.removeItem(draftSessionKey); } catch {} }
    setSessionReady(true);
  }, [draftSessionKey]);
  const [trial, setTrial] = useState<Workbench | null>(null), [pending, startTransition] = useTransition();
  useEffect(() => {
    try { const saved = JSON.parse(sessionStorage.getItem(undoSessionKey) ?? "null");
      if (saved && typeof saved.token === "string" && saved.expires > Date.now()) { setUndoToken(saved.token); setToast("Scénario appliqué"); }
      else sessionStorage.removeItem(undoSessionKey);
    } catch { /* Undo remains available in component state if storage is disabled. */ }
  }, [undoSessionKey]);
  useEffect(() => { if (!toast || pending) return; const timer = setTimeout(() => { setToast(null); try { sessionStorage.removeItem(undoSessionKey); } catch {} }, 10000); return () => clearTimeout(timer); }, [toast, pending, undoSessionKey]);
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
  const openEntity = (entity: string | null) => { lastFocus.current = focus; const next = monthWorkspaceFocus("center", entity); setFocus(next); setInfo(false); updateLocation("center", next); };
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
    if (operations.length) setMessage("Le mois a changé. Votre simulation est recalculée…");
    else setPurpose(model.defaultPurpose);
  }, [model.baseDigest, model.defaultPurpose, operations.length]);
  const recalculate = useCallback((nextOperations: readonly MonthChoiceOperation[], nextPurpose: MonthControlPurpose) => {
    const sequence = ++request.current;
    requested.current = JSON.stringify([model.baseDigest, nextPurpose, nextOperations]);
    setOperations(nextOperations); setPurpose(nextPurpose); setTrial(null);
    try { if (nextOperations.length) sessionStorage.setItem(draftSessionKey, JSON.stringify({ operations: nextOperations, purpose: nextPurpose, expires: Date.now() + 60 * 60_000 })); else sessionStorage.removeItem(draftSessionKey); } catch {}
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => startTransition(async () => {
      try { const result = await previewMonthControlCenter(model.targetMonth, nextPurpose, nextOperations);
        if (sequence === request.current) { setTrial(result); setMessage(null); if (result.baseDigest !== model.baseDigest) router.refresh(); } }
      catch { if (sequence === request.current) setMessage("Le scénario ne peut pas encore être calculé. Vérifiez ses choix ou réinitialisez-le ; le mois enregistré reste inchangé."); }
    }), nextOperations.length ? 180 : 0);
  }, [model.baseDigest, model.targetMonth, router, draftSessionKey]);
  useEffect(() => {
    if (!sessionReady || !open || section !== "choices" || !model.editable) return;
    const key = JSON.stringify([model.baseDigest, purpose, operations]);
    if (requested.current !== key) recalculate(operations, purpose);
  }, [sessionReady, open, section, operations, purpose, recalculate, model.baseDigest, model.editable]);
  useEffect(() => () => { if (previewTimer.current) clearTimeout(previewTimer.current); }, []);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const root = content.current;
      if (!root) return;
      root.scrollTop = 0;
      root.querySelectorAll<HTMLElement>("section,form,[data-choice-view],.ui-overlay-content").forEach(row => { row.scrollTop = 0; });
      const restored = [...root.querySelectorAll<HTMLElement>("[data-return-key]")].find(row => row.dataset.returnKey === lastFocus.current);
      const target = restored ?? root.querySelector<HTMLElement>("input:not([type=hidden]),select,[data-choice-view] ." + styles.localBack + ",button");
      target?.focus({ preventScroll: true });
      if (restored) { restored.dataset.controlHighlight = "true"; }
    });
    return () => cancelAnimationFrame(frame);
  }, [open, focus]);
  useEffect(() => {
    if (!open || info || !focus) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); event.stopPropagation();
      const destination = focus.startsWith("pilot:") ? "pilot" : focus.startsWith("update:status:") || focus === "update:references" ? "update" : focus.startsWith("update:") ? "update:status:NEEDS_UPDATE" : focus.startsWith("savings:") ? "savings" : null;
      lastFocus.current = focus; setFocus(destination); updateLocation("center", destination);
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [open, info, focus, updateLocation]);
  const replaceDraft = (operation: MonthChoiceOperation) => {
    try { recalculate(replaceMonthControlOperation(operations, operation), { kind: "FREE_EXPLORATION" }); }
    catch { setMessage("Vérifiez cette réduction. Deux cibles différentes au maximum peuvent être simulées."); }
  };
  const activeTrial = trial?.baseDigest === model.baseDigest ? trial : null;
  const apply = () => {
    if (!activeTrial?.preview || pending || !activeTrial.applicable) return;
    startTransition(async () => {
      try { const result = await applyMonthChoice(model.targetMonth, { operations }, activeTrial.baseDigest);
        if (result.ok) { ++request.current; setOperations([]); try { sessionStorage.removeItem(draftSessionKey); } catch {} setTrial(null); requested.current = null; setMessage(null); setUndoToken(result.undoToken); try { sessionStorage.setItem(undoSessionKey, JSON.stringify({ token: result.undoToken, expires: Date.now() + 10 * 60_000 })); } catch {} setToast(`Scénario appliqué · +${controlMoney(activeTrial.budgetMarginGain)} de marge estimée`); router.refresh(); }
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
        if (result.ok) { ++request.current; setTrial(null); requested.current = null; setMessage(null); setUndoToken(null); clearUndoSession();
          const intent = String(data.get("intent"));
          setToast(intent.includes("target") || intent.includes("goal") ? intent.includes("goal") ? "Objectif enregistré" : "Budget cible enregistré" : intent.includes("savings") ? intent.startsWith("add-") ? "✓ Cagnotte créée" : "✓ Cagnotte modifiée" : intent.includes("assumption") ? "✓ Ajustement enregistré" : "✓ Modification enregistrée");
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
      headerAside={<div className={styles.headerSummary} aria-label="Résumé du mois"><span>Fin de mois <strong>≈ {controlMoney(model.projectionSummary.economic?.central)}</strong></span><button type="button" className={styles.headerGoal} onClick={() => openEntity("global-goal")}>{model.settings.goal === null ? "+ Définir un objectif" : `Objectif ${controlMoney(model.settings.goal)}`}</button>{model.settings.goal !== null && <span>{Number(model.projectionSummary.globalDelta) >= 0 ? "+" : ""}{controlMoney(model.projectionSummary.globalDelta)}</span>}<div ref={infoRoot} className={styles.infoAnchor}><button ref={infoButton} type="button" aria-label="État des données" aria-expanded={info} aria-controls="month-control-info" className={styles.infoButton} onClick={() => { setInfo(!info); updateLocation("center", !info ? "info" : focus); }}><Info size={18} aria-hidden="true" /></button>{info && <section id="month-control-info" className={styles.infoPopover} aria-label="État des données"><MonthInfoFacts model={model} /></section>}</div></div>} className={`${material.page} ${styles.frame}`}
      closeAction={{ kind: "callback", onAction: close }} backgroundRootRef={background} restoreFocusRef={invoker} semanticFallbackRef={fallback} closeOnBackdrop>
      <div className={styles.layout}>
        <div ref={content} className={styles.content} data-control-content="" data-section={section} onSubmitCapture={sendForm}>
          {toast && <div role="status" className={styles.saveToast}>{toast}{undoToken && <button type="button" className={styles.textAction} disabled={pending} onClick={() => startTransition(async () => { const result = await undoMonthChoice(model.targetMonth, undoToken); if (result.ok) { setUndoToken(null); clearUndoSession(); setToast("Scénario annulé"); router.refresh(); } else setMessage(result.message); })}>Annuler</button>}</div>}
          {message && <p role="status" className={styles.status}>{message}</p>}
          <div key={focus ?? "root"} className={styles.surfaceMotion} style={{ "--zone-origin": focus?.includes("MODIFIED") ? "80% 20%" : focus?.includes("DISABLED") ? "20% 80%" : focus?.includes("CONFIRMED") ? "80% 80%" : "20% 20%" } as React.CSSProperties}><MonthLocalFocusProvider value={{ section, entity: focus, openEntity }}>
          {section === "update" ? <MonthUpdateSpatial model={model} refreshing={refreshingDigest === model.baseDigest} /> : focus === "pilot" ? <MonthPilotIndex model={model} draftCount={operations.length} /> : focus === "savings" ? <MonthControlSavings model={model} />
            : pilotCategory ? <MonthPilotCategory key={pilotCategory.key} model={model} category={pilotCategory} trial={activeTrial} operations={operations} pending={pending} replaceDraft={replaceDraft} reset={() => recalculate(operations.filter(row => row.kind !== "CATEGORY" || row.categoryKey !== pilotCategory.key), { kind: "FREE_EXPLORATION" })} apply={apply} />
            : targetCategory ? <TargetFocus key={`${targetCategory.key}:${targetCategory.target}`} model={model} category={targetCategory} /> : adjustmentCategory ? <AdjustmentFocus key={adjustmentCategory.key} model={model} category={adjustmentCategory} />
            : focus === "pilot:review" ? <MonthControlSimulator model={model} trial={activeTrial} purpose={purpose} operations={operations} pending={pending} replaceDraft={replaceDraft} recalculate={recalculate} apply={apply} />
            : focus ? <MonthChoiceFocus model={model} /> : <MonthWorkspaceRoot model={model} draftCount={operations.length} />}
          </MonthLocalFocusProvider></div>
          {pending && <p role="status" className={styles.pendingNotice}>Recalcul en cours…</p>}
        </div>
      </div>
    </OverlayFrame>
  </ControlContext.Provider>;
}
