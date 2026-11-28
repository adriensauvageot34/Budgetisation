"use client";

import { ChevronRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useOptimistic, useRef, type ReactNode } from "react";
import { startDetailTiming } from "@/components/layout/detail-timing";
import styles from "./savings.module.css";

type Project = { id: string; name: string; href: string; preview: ReactNode; detail: ReactNode };
type Deadline = { project: string; id: string; label: string; date: string; when: string; late: boolean; href: string };
type OpenProject = { project: string; anchor?: string };

export function SavingsDashboard({ projects, deadlines, initial, listHref, overview, filters, empty }: {
  projects: Project[]; deadlines: Deadline[]; initial?: OpenProject; listHref: string; overview: ReactNode; filters: ReactNode; empty: ReactNode;
}) {
  const router = useRouter();
  const [selection, setSelection] = useOptimistic(initial);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const dashboard = useRef<HTMLDivElement>(null);
  const timing = useRef<ReturnType<typeof startDetailTiming>>(null);
  const selected = projects.find(project => project.id === selection?.project);
  const projectId = selected?.id;
  const anchor = selection?.anchor;
  const loaded = !!selected?.detail;

  useEffect(() => {
    const panel = dialog.current;
    if (!panel || !projectId) return;
    if (!panel.open) panel.showModal();
    timing.current?.visible("structure");
    let observer: MutationObserver | undefined;
    function focusAnchor() {
      const target = anchor ? document.getElementById(anchor) : null;
      if (!target || !panel?.contains(target)) return false;
      const parentDetails = target.closest("details");
      if (parentDetails instanceof HTMLDetailsElement) parentDetails.open = true;
      const details = target.querySelector(":scope > details");
      if (details instanceof HTMLDetailsElement) details.open = true;
      target.scrollIntoView({ block: "start" });
      target.focus({ preventScroll: true });
      return true;
    }
    const frame = requestAnimationFrame(() => {
      if (focusAnchor()) return;
      closeButton.current?.focus({ preventScroll: true });
      if (!anchor) return;
      observer = new MutationObserver(() => { if (focusAnchor()) observer?.disconnect(); });
      observer.observe(panel, { childList: true, subtree: true });
    });
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [projectId, anchor]);
  useEffect(() => { if (loaded) timing.current?.visible("content"); }, [loaded, projectId]);
  useEffect(() => () => timing.current?.cancel(), []);

  function open(project: string, href: string, source: HTMLElement, anchor?: string) {
    trigger.current = source;
    timing.current?.cancel();
    timing.current = startDetailTiming("cagnottes");
    startTransition(() => {
      setSelection({ project, anchor });
      router.replace(href, { scroll: false });
    });
  }

  function close() {
    if (!dialog.current?.isConnected) return;
    timing.current?.cancel();
    startTransition(() => {
      setSelection(undefined);
      router.replace(listHref, { scroll: false });
    });
    requestAnimationFrame(() => (trigger.current ?? dashboard.current)?.focus({ preventScroll: true }));
  }

  return <div ref={dashboard} tabIndex={-1} className={styles.dashboard}>
    <div className={styles.overview}>
      {overview}
      <section className={styles.deadlines} aria-labelledby="savings-deadlines">
        <h2 id="savings-deadlines">Prochaines échéances</h2>
        {deadlines.length ? <ul>{deadlines.map(deadline => {
          const label = <><span>{deadline.label}</span><time dateTime={deadline.date}>{deadline.when}</time>
            <ChevronRight size={14} aria-hidden /></>;
          return <li key={deadline.id}><button type="button" aria-haspopup="dialog" data-late={deadline.late}
            onClick={event => open(deadline.project, deadline.href, event.currentTarget, `cagnotte-${deadline.id}`)}>{label}</button></li>;
        })}</ul> : <p>Aucune échéance renseignée pour les postes ouverts.</p>}
      </section>
    </div>
    {filters}
    {projects.some(project => project.preview) ? <div className={styles.projectGrid}>
      {projects.map(project => project.preview && <section className={styles.projectTile} data-project={project.id} key={project.id}>
        {project.preview}
        <button className={styles.projectOpen} type="button" aria-label={`Ouvrir ${project.name}`} aria-haspopup="dialog"
          onFocus={() => router.prefetch(project.href)} onPointerEnter={event => { if (event.pointerType === "mouse") router.prefetch(project.href); }}
          onClick={event => open(project.id, project.href, event.currentTarget)}><ChevronRight size={20} aria-hidden /></button>
      </section>)}
    </div> : empty}
    <dialog ref={dialog} className={styles.projectDrawer} data-project={selected?.id} aria-labelledby="savings-project-title"
      onClose={close} onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      {selected && <div className={styles.drawerInside}>
        <header className={styles.drawerTitle}>
          <h2 id="savings-project-title">{selected.name}</h2>
          <button ref={closeButton} type="button" className={styles.drawerClose} aria-label="Fermer le projet"
            onClick={() => dialog.current?.close()}><X size={22} aria-hidden /></button>
        </header>
        <div className={styles.drawerBody}>{selected.detail ? <div data-budget-reveal>{selected.detail}</div> : <div className={styles.projectPlaceholder} role="status">
          <span className="sr-only">Chargement du projet…</span><i /><i /><i />
        </div>}</div>
      </div>}
    </dialog>
  </div>;
}
