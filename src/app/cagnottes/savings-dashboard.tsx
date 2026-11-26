"use client";

import { ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./savings.module.css";

type Project = { id: string; name: string; preview: ReactNode; detail: ReactNode };
type Deadline = { project: string; id: string; label: string; date: string; when: string; late: boolean; href?: string };
type OpenProject = { project: string; anchor?: string };

export function SavingsDashboard({ projects, deadlines, initial, overview, filters, empty }: {
  projects: Project[]; deadlines: Deadline[]; initial?: OpenProject; overview: ReactNode; filters: ReactNode; empty: ReactNode;
}) {
  const [selection, setSelection] = useState(initial);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const dashboard = useRef<HTMLDivElement>(null);
  const selected = projects.find(project => project.id === selection?.project);

  useEffect(() => {
    const panel = dialog.current;
    if (!panel || !selected) return;
    if (!panel.open) panel.showModal();
    const frame = requestAnimationFrame(() => {
      const target = selection?.anchor ? document.getElementById(selection.anchor) : null;
      if (target && panel.contains(target)) {
        const parentDetails = target.closest("details");
        if (parentDetails instanceof HTMLDetailsElement) parentDetails.open = true;
        const details = target.querySelector(":scope > details");
        if (details instanceof HTMLDetailsElement) details.open = true;
        target.scrollIntoView({ block: "start" });
        target.focus({ preventScroll: true });
      } else closeButton.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [selected, selection]);

  function open(project: string, source: HTMLElement, anchor?: string) {
    trigger.current = source;
    setSelection({ project, anchor });
  }

  function close() {
    if (!dialog.current?.isConnected) return;
    setSelection(undefined);
    const url = new URL(window.location.href);
    if (["project", "goal", "report"].some(key => url.searchParams.has(key))) {
      for (const key of ["project", "goal", "report"]) url.searchParams.delete(key);
      url.hash = "";
      window.history.replaceState(null, "", url);
    }
    requestAnimationFrame(() => (trigger.current ?? dashboard.current)?.focus({ preventScroll: true }));
  }

  return <div ref={dashboard} tabIndex={-1} className={styles.dashboard}>
    <div className={styles.overview}>
      {overview}
      <section className={styles.deadlines} aria-labelledby="savings-deadlines">
        <h2 id="savings-deadlines">Échéances proches</h2>
        {deadlines.length ? <ul>{deadlines.map(deadline => {
          const label = <><span>{deadline.label}</span><time dateTime={deadline.date}>{deadline.when}</time>
            <ChevronRight size={14} aria-hidden /></>;
          return <li key={deadline.id}>{deadline.href
            ? <Link href={deadline.href} data-late={deadline.late} aria-haspopup="dialog">{label}</Link>
            : <button type="button" aria-haspopup="dialog" data-late={deadline.late}
              onClick={event => open(deadline.project, event.currentTarget, `cagnotte-${deadline.id}`)}>{label}</button>}
          </li>;
        })}</ul> : <p>Aucun poste à échéance dans les 30 prochains jours.</p>}
      </section>
    </div>
    {filters}
    {projects.some(project => project.preview) ? <div className={styles.projectGrid}>
      {projects.map(project => project.preview && <section className={styles.projectTile} data-project={project.id} key={project.id}>
        {project.preview}
        <button className={styles.projectOpen} type="button" aria-label={`Ouvrir ${project.name}`} aria-haspopup="dialog"
          onClick={event => open(project.id, event.currentTarget)}><ChevronRight size={20} aria-hidden /></button>
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
        <div className={styles.drawerBody}>{selected.detail}</div>
      </div>}
    </dialog>
  </div>;
}
