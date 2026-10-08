/** Strip the published subject scope; the remaining slot identity is stable. */
export function stableVisualIdentity(identityRef: string): string {
  return identityRef.replace(/^PERSON:[^:]+:/u, "");
}
