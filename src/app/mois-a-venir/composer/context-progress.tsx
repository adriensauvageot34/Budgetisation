import { createContext, useContext } from "react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { contextFingerprints } from "@/domain/phase2/planner/context-fingerprints";
import { monthLabel } from "./display";
import type { PreviewStatus } from "./preview-scheduler";
import styles from "./composer.module.css";

type IntentionProgress = Readonly<{ month: string; lifecycle: string; projection: string; saved: boolean }>;
export const ContextProgress = createContext<Readonly<Record<string, IntentionProgress>> | null>(null);

export function composerContextProgress(model: ComposerUiModel, status: PreviewStatus, savedDigest?: string, temporary = false) {
  const { board, semanticState, budgetReading } = model;
  const digest = board.draft.semanticStateDigest;
  const matching = board.targetMonth === semanticState.targetMonth && budgetReading?.semanticStateDigest === digest;
  const available = !temporary && status === "FRESH" && matching && board.cockpit.projectionCompleteness !== "UNKNOWN";
  const evaluated = available ? budgetReading.byContext : {};
  const byId = new Map(semanticState.contexts.map(item => [item.contextOccurrenceId, item]));
  const linkedEvaluated = new Set<string>();
  for (const [id, amount] of Object.entries(evaluated)) {
    if (amount.gross === null && amount.knownSubtotal === null) continue;
    for (let parent = byId.get(id)?.parentContextOccurrenceId; parent && !linkedEvaluated.has(parent); parent = byId.get(parent)?.parentContextOccurrenceId)
      linkedEvaluated.add(parent);
  }
  const draftSaved = !temporary && savedDigest === digest;
  const activeDigests = !temporary && model.activeRevisionId ? model.appliedContextDigests : undefined;
  const digests = activeDigests ? contextFingerprints(semanticState) : undefined;
  return Object.fromEntries(board.contexts.map(card => {
    const id = card.contextOccurrenceId;
    const local = byId.has(id);
    const impact = evaluated[id];
    const projected = impact && (impact.gross !== null || impact.knownSubtotal !== null);
    const applied = !!activeDigests?.[id] && activeDigests[id] === digests?.[id];
    const lifecycle = !local ? "Source externe" : applied ? `Appliqué · révision ${model.activeRevisionNumber}`
      : draftSaved ? "Sauvegardé" : "Brouillon";
    const projection = available ? linkedEvaluated.has(id) ? "Projection des intentions liées" : projected ? impact.gross === null ? "Projeté · coût partiel" : "Projeté" : "Projection disponible"
      : status === "BLOCKED" ? "Projection bloquée" : status === "PENDING" ? "Projection en cours"
        : status === "STALE" ? "Projection à recalculer" : "Projection indisponible";
    return [id, { month: board.targetMonth, lifecycle, projection, saved: local && draftSaved }] as const;
  }));
}

export function IntentionProgressLabel({ id, withMonth = false, compact = false }: { id: string; withMonth?: boolean; compact?: boolean }) {
  const progress = useContext(ContextProgress)?.[id];
  if (!progress) return null;
  const label = [withMonth ? monthLabel(progress.month) : null, progress.lifecycle,
    progress.saved && progress.lifecycle !== "Sauvegardé" ? "Brouillon sauvegardé" : null, progress.projection].filter(Boolean).join(" · ");
  return <small className={styles.intentionProgress} data-intention-progress={id} title={label} aria-label={compact ? label : undefined}>
    {compact ? progress.lifecycle : label}
  </small>;
}
