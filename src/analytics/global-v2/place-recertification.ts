import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonicalSerializeGlobal } from "../../core/global-v2";
import { nonDailyRelationshipPlan } from "./relationship-catalog";
import type { buildGlobalMomentExperiences } from "./moments";
import type { buildGlobalPlaceMobility } from "./places";

const digest = (value: unknown) => bytesToHex(sha256(utf8ToBytes(canonicalSerializeGlobal(value))));

/** P08 closure replay for every relationship definition owned by P08.
 * This does not fabricate p-values. A descriptive M6 comparison or M7 visit is
 * not automatically a paired association test. The existing FDR universe
 * already contains every examined definition, so no q-value changes when all
 * new providers remain ineligible with an explicit reason. */
export function recertifyGlobalCDForPlaceAndMoment(input: {
  readonly moments: ReturnType<typeof buildGlobalMomentExperiences>;
  readonly places: ReturnType<typeof buildGlobalPlaceMobility>;
}) {
  const p08 = nonDailyRelationshipPlan.filter((definition) => definition.owner === "P08");
  const examinations = p08.map((definition) => {
    const reason = definition.id.startsWith("moment-type-")
      ? "M6_DESCRIPTIVE_COHORT_IS_NOT_M5_PAIRED_RELATIONSHIP"
      : definition.id === "work-place-visit-external-meal"
        ? "DATED_WORK_ROLE_AND_PAIRED_OUTCOME_AUTHORITY_UNAVAILABLE"
        : definition.id.includes("place-visit")
          ? "MOBILITY_OR_LOCALIZED_PURCHASE_PROVIDER_UNAVAILABLE"
          : definition.id.includes("mobility") || definition.id.includes("transport")
            ? "MOBILITY_AUTHORITY_GATES_CLOSED"
            : "SHARED_PARTICIPATION_AND_MOBILITY_AUTHORITY_UNAVAILABLE";
    return { id: definition.id, family: definition.family, grain: definition.grain, eligible: false as const, status: "EXCLUDED_WITH_REASON" as const, reason };
  });
  if (examinations.length !== p08.length || new Set(examinations.map(({ id }) => id)).size !== examinations.length) throw new TypeError("P08_RELATIONSHIP_REPLAY_INCOMPLETE");
  const mobilityAvailable = (input.places.mobilityCapabilities.routes as { readonly state: string }).state === "AVAILABLE";
  if (mobilityAvailable) throw new TypeError("P08_MOBILITY_REQUIRES_T01_RECERTIFICATION_BEFORE_ACTIVATION");
  return {
    replayVersion: "global-e-to-cd-replay@v1",
    examinedDefinitions: examinations,
    fdrUniverseChanged: false as const,
    qValuesChanged: false as const,
    sourceDependsOnRelationshipResult: false as const,
    m3Signals: input.places.crossModuleSignals,
    momentSeriesSignals: input.moments.crossModuleSignals.m3SeriesEvolution,
    closureDigest: digest({ examinations, m3: input.places.crossModuleSignals, moment: input.moments.crossModuleSignals, placeInput: input.places.inputHash, momentInput: input.moments.inputHash }),
  };
}
