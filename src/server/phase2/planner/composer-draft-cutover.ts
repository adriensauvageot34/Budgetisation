import "server-only";

/** A production canary can use Drafts without exposing its editor to other users. */
export function composerDraftAutosaveEnabledFor(userId: string): boolean {
  if (process.env.COMPOSER_DRAFT_AUTOSAVE_ENABLED !== "true") return false;
  const canary = process.env.COMPOSER_DRAFT_AUTOSAVE_CANARY_USER_ID;
  if (canary === undefined) return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(canary)
    && canary === userId;
}
