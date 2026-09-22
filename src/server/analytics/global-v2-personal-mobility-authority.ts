import "server-only";

import { Temporal } from "@js-temporal/polyfill";
import { buildGlobalM7PersonalMobilityAuthority } from "@/analytics/global-v2";
import { addDays, parseLocalDate } from "@/core/time";
import type { CanonicalRepository } from "@/server/canonical/repository";
import { resolveGlobalM7MobilityContextAuthority } from "./global-v2-mobility-context-authority";

/**
 * Compact, read-only M7 owner projection. Context links remain internal to M7;
 * downstream consumers receive only deduplicated personal summaries.
 */
export async function resolveGlobalM7PersonalMobilityAuthority(input: {
  readonly repository: CanonicalRepository;
  readonly certifiedThrough?: string;
}) {
  const contextAuthority = await resolveGlobalM7MobilityContextAuthority(input);
  const context = input.repository.context;
  const certifiedThrough = input.certifiedThrough
    ?? Temporal.Instant.from(context.asOf).toZonedDateTimeISO(context.timezone).toPlainDate().toString();
  const earliestMonth = context.periods.map((period) => period.month.slice(0, 7)).sort()[0]
    ?? Temporal.PlainDate.from(certifiedThrough).subtract({ months: 12 }).toString().slice(0, 7);
  const range = { start: parseLocalDate(`${earliestMonth}-01`), endExclusive: addDays(parseLocalDate(certifiedThrough), 1) };
  const authority = buildGlobalM7PersonalMobilityAuthority({
    mobilityLegs: await input.repository.loadMobilityLegFacts(range),
    contextLinks: contextAuthority.contextLinks,
    presenceResolutions: contextAuthority.presenceResolutions,
  });
  return {
    ...authority,
    contextAuthorityHash: contextAuthority.outputHash,
    contextLinkCount: contextAuthority.contextLinks.length,
    presenceResolutionCount: contextAuthority.presenceResolutions.length,
  };
}
