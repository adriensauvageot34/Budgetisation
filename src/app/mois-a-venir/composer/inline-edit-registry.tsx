"use client";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { useCommittedEvent } from "./use-committed-event";

type InlineEdit = Readonly<{ targetRef: string; dimension: string; kind: "RAW" | "PENDING";
  discard(): void; flush(): void; save?: { label: string; run(): boolean } }>;

/** Only field identity and lifecycle callbacks travel to the shell. Text stays
 * inside its editor. This is neither a semantic Draft nor a save/Preview queue. */
export class InlineEditRegistry {
  requestConfirmation: (message: string, accept: () => void, save?: { label: string; run(): boolean }) => void = () => {};
  private readonly fields = new Map<string, InlineEdit>();
  private readonly listeners = new Set<() => void>();
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  count = () => this.fields.size;
  private notify() { this.listeners.forEach(listener => listener()); }
  set(key: string, edit: InlineEdit | null) {
    const previous = this.fields.get(key);
    if (edit) this.fields.set(key, edit); else this.fields.delete(key);
    if (!!previous !== !!edit || previous?.kind !== edit?.kind) this.notify();
  }
  flushPending() {
    const pending = [...this.fields.values()].filter(edit => edit.kind === "PENDING");
    for (const edit of pending) edit.flush();
    return pending.length;
  }
  confirmDiscard(confirm: (message: string) => boolean, targets?: ReadonlySet<string>): boolean {
    const raw = [...this.fields.entries()].filter(([, edit]) => edit.kind === "RAW" && (!targets || targets.has(edit.targetRef)));
    if (!raw.length) return true;
    if (!confirm("Cette saisie n’est pas validée. L’abandonner pour continuer ?")) return false;
    for (const [key, edit] of raw) { this.set(key, null); edit.discard(); }
    return true;
  }
  guard(continueAfterDiscard: () => void, targets?: ReadonlySet<string>): boolean {
    const raw = [...this.fields.entries()].filter(([, edit]) => edit.kind === "RAW" && (!targets || targets.has(edit.targetRef)));
    if (!raw.length) return true;
    const unchanged = () => raw.every(([key, edit]) => this.fields.get(key) === edit);
    this.requestConfirmation("Votre saisie n’est pas encore validée. Les décisions déjà conservées resteront dans le brouillon.", () => {
      // Only discard the registered buffers for this question. Do not approve a new buffer appearing meanwhile.
      if (raw.some(([key, edit]) => this.fields.get(key) !== edit)) return;
      for (const [key, edit] of raw) { this.set(key, null); edit.discard(); }
      continueAfterDiscard();
    }, raw.length===1 && raw[0][1].save ? {label:raw[0][1].save.label,run:()=>{
      if (!unchanged() || !raw[0][1].save!.run()) return false;
      this.set(raw[0][0],null);
      continueAfterDiscard();
      return true;
    }} : undefined);
    return false;
  }
}
export const InlineEditContext = createContext<InlineEditRegistry | null>(null);
export const useInlineEditRegistry = () => useContext(InlineEditContext);
/** Registers presentation-only buffers with the existing navigation/Undo guard.
 * RAW is never autosaved or financially admitted by this hook. */
export function useWorkshopRaw(targetRef: string, dirty: boolean, discard: () => void, dimension = "workshop",
  save?: { label: string; run(): boolean; bufferKey: string }) {
  const registry = useInlineEditRegistry(), discardCurrent = useCommittedEvent(discard);
  const saveCurrent = useCommittedEvent(() => save?.run() ?? false);
  useEffect(() => {
    const key = `${dimension}:${targetRef}`;
    registry?.set(key, dirty ? { targetRef, dimension, kind: "RAW", discard: discardCurrent, flush: () => {},
      ...(save?{save:{label:save.label,run:saveCurrent}}:{}) } : null);
    return () => registry?.set(key, null);
  }, [registry, targetRef, dirty, dimension, discardCurrent,saveCurrent,save?.label,save?.bufferKey]);
  return (continueAfterDiscard: () => void) => registry ? registry.guard(continueAfterDiscard, new Set([targetRef])) : !dirty;
}
export function useOwnedInlineEdits() {
  const [registry] = useState(() => new InlineEditRegistry());
  const count = useSyncExternalStore(registry.subscribe, registry.count, () => 0);
  return { registry, count };
}
