import Big from "big.js";
import { apiMetaSchema } from "../../core/api";
import { parseInstant } from "../../core/time";
import {
  parseAnalyticsRevision,
  parseDataRevision,
  parseMethodVersion,
} from "../../core/versions";
import { validateProducedMetric } from "../production";
import type {
  AnalyticsPublicationArtifact,
  AnalyticsPublicationCandidate,
  AnalyticsPublicationStore,
  AnalyticsPublishedState,
  AnalyticsRecomputeDraft,
  AnalyticsRevisionState,
  PublicationApiMetaInput,
  PublishedApiMeta,
} from "./types";

export const analyticsMaterializationStrategy = {
  physicalSnapshots: "NOT_REQUIRED_YET",
  reason: "no_profiled_performance_bottleneck",
  reusableTruth: ["views", "functions", "indexes", "rpc", "analytics_code"],
  prohibitedTruth: ["page_json"],
} as const;

export class AnalyticsPublicationBlockedError extends Error {
  readonly code = "PUBLICATION_BLOCKED" as const;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AnalyticsPublicationBlockedError";
  }
}

function requireArtifactId(value: string): string {
  if (value.trim().length === 0) {
    throw new AnalyticsPublicationBlockedError(
      "Un artifactId de publication ne peut pas être vide.",
    );
  }
  return value;
}

function nextAnalyticsRevision(
  revision: AnalyticsRevisionState["analyticsRevision"],
): AnalyticsRevisionState["analyticsRevision"] {
  return parseAnalyticsRevision(new Big(revision).plus(1).toFixed());
}

export function beginAnalyticsRecompute(input: {
  readonly current: AnalyticsRevisionState;
  readonly sourceDataRevision: AnalyticsRevisionState["dataRevision"];
  readonly impacts: AnalyticsRecomputeDraft["impacts"];
  readonly requiredArtifactIds: readonly string[];
}): AnalyticsRecomputeDraft {
  if (input.impacts.length === 0) {
    throw new AnalyticsPublicationBlockedError(
      "Un changement technique sans impact ne déclenche pas de publication.",
    );
  }
  const requiredArtifactIds = input.requiredArtifactIds.map(requireArtifactId);
  if (new Set(requiredArtifactIds).size !== requiredArtifactIds.length) {
    throw new AnalyticsPublicationBlockedError(
      "requiredArtifactIds contient un doublon.",
    );
  }
  return {
    householdId: input.current.householdId,
    baseDataRevision: parseDataRevision(input.current.dataRevision),
    baseAnalyticsRevision: parseAnalyticsRevision(
      input.current.analyticsRevision,
    ),
    sourceDataRevision: parseDataRevision(input.sourceDataRevision),
    impacts: [...input.impacts],
    requiredArtifactIds,
  };
}

export function revisionAfterFailedRecompute(
  current: AnalyticsRevisionState,
): AnalyticsRevisionState {
  return current;
}

function validateArtifact(
  artifact: AnalyticsPublicationArtifact,
  sourceDataRevision: AnalyticsRevisionState["dataRevision"],
): AnalyticsPublicationArtifact {
  requireArtifactId(artifact.artifactId);
  if (parseDataRevision(artifact.sourceDataRevision) !== sourceDataRevision) {
    throw new AnalyticsPublicationBlockedError(
      "Un artefact nouveau dépend d’une DataRevision incohérente.",
    );
  }
  for (const dependency of artifact.dependencies) {
    requireArtifactId(dependency.artifactId);
    if (
      dependency.status !== "fresh" ||
      parseDataRevision(dependency.sourceDataRevision) !== sourceDataRevision
    ) {
      throw new AnalyticsPublicationBlockedError(
        "Une dépendance stale interdit la publication cohérente.",
      );
    }
    if (dependency.methodVersion !== undefined) {
      parseMethodVersion(dependency.methodVersion);
    }
    if (
      dependency.requiredMethodVersion !== undefined &&
      (dependency.methodVersion === undefined ||
        parseMethodVersion(dependency.requiredMethodVersion) !==
          dependency.methodVersion)
    ) {
      throw new AnalyticsPublicationBlockedError(
        "Une MethodVersion stale interdit la publication cohérente.",
      );
    }
  }
  return { ...artifact, metric: validateProducedMetric(artifact.metric) };
}

export function prepareAnalyticsPublication(input: {
  readonly current: AnalyticsRevisionState;
  readonly candidate: AnalyticsPublicationCandidate;
}): AnalyticsPublishedState {
  const { current, candidate } = input;
  if (
    current.householdId !== candidate.draft.householdId ||
    current.analyticsRevision !== candidate.draft.baseAnalyticsRevision ||
    current.dataRevision !== candidate.draft.baseDataRevision
  ) {
    throw new AnalyticsPublicationBlockedError(
      "L’état de révision a changé depuis le début du recalcul.",
    );
  }
  const artifacts = candidate.artifacts.map((artifact) =>
    validateArtifact(artifact, candidate.draft.sourceDataRevision),
  );
  const byId = new Map<string, AnalyticsPublicationArtifact>();
  for (const artifact of artifacts) {
    if (byId.has(artifact.artifactId)) {
      throw new AnalyticsPublicationBlockedError(
        "Deux artefacts portent le même artifactId.",
      );
    }
    byId.set(artifact.artifactId, artifact);
  }
  for (const requiredArtifactId of candidate.draft.requiredArtifactIds) {
    if (!byId.has(requiredArtifactId)) {
      throw new AnalyticsPublicationBlockedError(
        "Le périmètre publié omet une dépendance requise.",
      );
    }
  }
  return {
    householdId: current.householdId,
    dataRevision: candidate.draft.sourceDataRevision,
    analyticsRevision: nextAnalyticsRevision(current.analyticsRevision),
    publishedAt: parseInstant(candidate.publishedAt),
    artifacts,
  };
}

export async function publishAnalyticsCandidate(input: {
  readonly store: AnalyticsPublicationStore;
  readonly candidate: AnalyticsPublicationCandidate;
}): Promise<AnalyticsPublishedState> {
  const current = await input.store.readRevisionState(
    input.candidate.draft.householdId,
  );
  const nextState = prepareAnalyticsPublication({
    current,
    candidate: input.candidate,
  });
  const published = await input.store.publishAtomically({
    expectedAnalyticsRevision: current.analyticsRevision,
    nextState,
  });
  if (!published) {
    throw new AnalyticsPublicationBlockedError(
      "La publication atomique a refusé un état concurrent.",
    );
  }
  return nextState;
}

export function createPublicationApiMeta(
  state: AnalyticsRevisionState,
  input: PublicationApiMetaInput,
): PublishedApiMeta {
  return apiMetaSchema.parse({
    dataRevision: state.dataRevision,
    analyticsRevision: state.analyticsRevision,
    contractVersion: input.contractVersion,
    computedAt: input.computedAt,
  });
}
