"use client";
import { createContext, useContext, useState, useSyncExternalStore } from "react";

type InlineEdit = Readonly<{ targetRef: string; dimension: string; kind: "RAW" | "PENDING";
  discard(): void; flush(): void }>;

/** Only field identity and lifecycle callbacks travel to the shell. Text stays
 * inside its editor. This is neither a semantic Draft nor a save/Preview queue. */
export class InlineEditRegistry {
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
}
export const InlineEditContext = createContext<InlineEditRegistry | null>(null);
export const useInlineEditRegistry = () => useContext(InlineEditContext);
export function useOwnedInlineEdits() {
  const [registry] = useState(() => new InlineEditRegistry());
  const count = useSyncExternalStore(registry.subscribe, registry.count, () => 0);
  return { registry, count };
}
