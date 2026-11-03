import "server-only";

/** Independent, fail-closed N1 activation. Never implied by financial Draft eligibility. */
export function composerRootRelationsEnabled(): boolean {
  try { return process.env.COMPOSER_ROOT_RELATIONS_ENABLED === "true"; }
  catch { return false; }
}
