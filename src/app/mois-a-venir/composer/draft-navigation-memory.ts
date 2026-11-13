type DraftNavigation = Readonly<{ draftId: string; digest: string; contextId: string }>;

export function restoreDraftNavigation(raw: string | null, draft: Pick<DraftNavigation, "draftId" | "digest">,
  available: ReadonlySet<string>): string | null {
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as Partial<DraftNavigation> | null;
    return entry?.draftId === draft.draftId && entry.digest === draft.digest
      && typeof entry.contextId === "string" && available.has(entry.contextId) ? entry.contextId : null;
  } catch {
    return null;
  }
}

const key = (scope: string) => `composer:draft-navigation:${scope}`;

export function readDraftNavigation(scope: string, draft: Pick<DraftNavigation, "draftId" | "digest">, available: ReadonlySet<string>) {
  try {
    return restoreDraftNavigation(window.sessionStorage.getItem(key(scope)), draft, available);
  } catch {
    return null;
  }
}

export function rememberDraftNavigation(scope: string, entry: DraftNavigation | null) {
  try {
    if (entry) window.sessionStorage.setItem(key(scope), JSON.stringify(entry));
    else window.sessionStorage.removeItem(key(scope));
  } catch {
    // Navigation remains available when session storage is disabled.
  }
}
