import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { PlanBalanceSuggestions } from "@/domain/phase2/planner/adjustment-contract";
export type ComparisonSnapshot = Readonly<{ model: ComposerUiModel; past: PlanSemanticStateV1[]; future: PlanSemanticStateV1[]; suggestions: PlanBalanceSuggestions | null }>;
/** Immutable local branch: no transport, persistence, arithmetic or automatic Apply. */
export function finishComparison(snapshot: ComparisonSnapshot, variant: ComposerUiModel, keep: boolean) {
  if (!keep) return snapshot;
  return { model: variant, past: variant.board.draft.semanticStateDigest === snapshot.model.board.draft.semanticStateDigest ? snapshot.past : [...snapshot.past, snapshot.model.semanticState],
    future: [], suggestions: null };
}
