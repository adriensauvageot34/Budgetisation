"use client";
import type { ComposerRequest, ComposerResponse } from "@/domain/phase2/planner/composer-ui-contract";
import { plannerRecord } from "@/domain/phase2/planner/json";
import { parsePlanSemanticState, semanticStateDigest } from "@/domain/phase2/planner/semantic-state";

/** Scheduler still owns sequence/digest admission. Never retries as a Server Action. */
export async function composerPreviewHttp(request: ComposerRequest): Promise<ComposerResponse> {
  if (request.kind !== "READ" && request.kind !== "SUGGESTIONS") throw new TypeError("PREVIEW_READ_ONLY");
  const response = await fetch("/api/composer/preview", { method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json", "X-Composer-Preview-Contract": "composer-preview-http@1" },
    body: JSON.stringify(request) });
  if (response.headers.get("X-Composer-Preview-Contract") !== "composer-preview-http@1")
    throw new TypeError("PREVIEW_CONTRACT_INCOMPATIBLE");
  if (!response.ok) throw new TypeError("PREVIEW_UNAVAILABLE");
  const value = plannerRecord(await response.json());
  if (value.sequence !== request.sequence || typeof value.ok !== "boolean" || value.applied || value.applyReceipt)
    throw new TypeError("PREVIEW_RESPONSE_INVALID");
  if (value.ok) {
    const model = plannerRecord(value.model), state = parsePlanSemanticState(model.semanticState);
    const board = plannerRecord(model.board), draft = plannerRecord(board.draft);
    plannerRecord(board.cockpit); plannerRecord(model.proof);
    if (state.targetMonth !== request.targetMonth || draft.semanticStateDigest !== semanticStateDigest(state))
      throw new TypeError("PREVIEW_RESPONSE_INVALID");
  } else if (typeof value.code !== "string" || typeof value.message !== "string") throw new TypeError("PREVIEW_RESPONSE_INVALID");
  return value as unknown as ComposerResponse;
}
