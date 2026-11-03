"use client";
import type { ComposerLocalFrame } from "@/domain/phase2/planner/root-relation-local";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerDraftSnapshot } from "@/domain/phase2/planner/composer-draft-contract";
import type { RootRelationBinding } from "@/domain/phase2/planner/root-relation-ui-contract";
export type RootRelationWorkspace = Readonly<{ frame: ComposerLocalFrame; model: ComposerUiModel;
  past: ComposerLocalFrame[]; future: ComposerLocalFrame[]; binding: RootRelationBinding; drafts: ComposerDraftSnapshot | null;
  relationSession: boolean }>;
// Tab memory only. Survives SPA back/remount; never crosses an authenticated scope or a hard reload.
const pending = new Map<string, RootRelationWorkspace>();
const warn = (event: BeforeUnloadEvent) => { if (pending.size) event.preventDefault(); };
export const readRootWorkspace = (key: string) => typeof window === "undefined" ? undefined : pending.get(key);
export function rememberRootWorkspace(key: string, value: RootRelationWorkspace) {
  pending.set(key, value); window.addEventListener("beforeunload", warn);
}
export function discardRootWorkspace(key: string) {
  pending.delete(key); if (!pending.size) window.removeEventListener("beforeunload", warn);
}
