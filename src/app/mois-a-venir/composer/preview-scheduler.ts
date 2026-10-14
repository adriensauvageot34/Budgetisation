import type { ComposerResponse, ComposerTransport } from "@/domain/phase2/planner/composer-ui-contract";
import { semanticStateDigest, type PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";

export type PreviewStatus = "PENDING" | "FRESH" | "STALE" | "FAILED" | "BLOCKED";
type Authority = Readonly<{ draftDigest: string; targetMonth: string; worldVersion: string }>;
type Ticket = Authority & Readonly<{ sequence: number }>;
export const composerInteractionReuseEnabled = process.env.NEXT_PUBLIC_COMPOSER_P14_P2_INTERACTIONS !== "0";

/** Orders server Compiler/V2 reads. It contains no financial calculation. */
export class ComposerPreviewScheduler {
  private sequence = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private pendingTicket: Ticket | null = null;
  pending() { return this.pendingTicket !== null; }
  // Invalidates acceptance and cancels unsent timers; already sent SQL is not cancelled.
  cancel() { ++this.sequence; if (this.timer) clearTimeout(this.timer); this.timer = null; this.pendingTicket = null; }
  revive() { this.disposed = false; }
  dispose() { this.cancel(); this.disposed = true; }
  schedule(draft: PlanSemanticStateV1, worldVersion: string, transport: ComposerTransport,
    current: () => Authority, status: (value: PreviewStatus) => void, finish: (response: ComposerResponse) => void, delay = 160) {
    if (this.disposed) return;
    const draftDigest = semanticStateDigest(draft), pending = this.pendingTicket;
    if (composerInteractionReuseEnabled && pending && pending.draftDigest === draftDigest
      && pending.targetMonth === draft.targetMonth && pending.worldVersion === worldVersion
      && this.accepts(pending, pending.sequence, current())) { status("PENDING"); return; }
    this.cancel();
    const ticket: Ticket = { sequence: this.sequence, draftDigest, targetMonth: draft.targetMonth, worldVersion };
    this.pendingTicket = ticket;
    status("PENDING");
    this.timer = setTimeout(async () => {
      this.timer = null;
      try {
        const response = await transport({ kind: "READ", sequence: ticket.sequence, targetMonth: ticket.targetMonth, draft });
        if (!this.accepts(ticket, response.sequence, current())) return;
        if (!response.ok) { status(/STALE|CHANGED/u.test(response.code) ? "STALE" : "FAILED"); finish(response); return; }
        if (response.model.semanticState.targetMonth !== ticket.targetMonth || response.model.board.draft.semanticStateDigest !== ticket.draftDigest) {
          status("STALE"); return;
        }
        status(response.model.board.cockpit.applyReadiness === "BLOCKED" ? "BLOCKED" : "FRESH");
        finish(response);
      } catch {
        if (this.accepts(ticket, ticket.sequence, current())) status("FAILED");
      } finally {
        if (this.pendingTicket === ticket) this.pendingTicket = null;
      }
    }, delay);
  }
  accepts(ticket: Ticket, responseSequence: number, current: Authority) {
    return !this.disposed && ticket.sequence === this.sequence && responseSequence === ticket.sequence
      && ticket.draftDigest === current.draftDigest && ticket.targetMonth === current.targetMonth && ticket.worldVersion === current.worldVersion;
  }
}
