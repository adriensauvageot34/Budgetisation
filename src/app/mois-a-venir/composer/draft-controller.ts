/** Request ordering is UI-only. No projections, arithmetic or mutation of semantic state. */
export class ComposerResponseGate {
  private sequence = 0;
  next(sourceDigest: string) { return { sequence: ++this.sequence, sourceDigest }; }
  invalidate() { ++this.sequence; }
  accepts(ticket: { sequence: number; sourceDigest: string }, responseSequence: number, currentDigest: string) {
    return ticket.sequence === this.sequence && responseSequence === ticket.sequence && ticket.sourceDigest === currentDigest;
  }
}
