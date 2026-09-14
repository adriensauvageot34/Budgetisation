import type { GlobalCompactInsight, GlobalDetailRow, GlobalExpandedReadModel, GlobalMomentComparisonContext } from "@/query-api/global-v2";

export type RhythmNarrative = {
  readonly primary?: GlobalCompactInsight;
  readonly primaryRow?: GlobalDetailRow;
  readonly habits: readonly GlobalDetailRow[];
  readonly moments: readonly GlobalDetailRow[];
  readonly changes: readonly GlobalCompactInsight[];
  readonly relationships: readonly GlobalCompactInsight[];
};

export function rhythmHeroComparison(narrative: Pick<RhythmNarrative, "primary" | "primaryRow">): GlobalMomentComparisonContext | undefined {
  if (narrative.primary?.kind !== "M6_MATERIAL_COMPARISON") return undefined;
  return narrative.primaryRow?.momentComparison;
}

function insights(model: GlobalExpandedReadModel | undefined): readonly GlobalCompactInsight[] {
  if (model === undefined) return [];
  return [model.primaryInsight, ...model.secondaryInsights].filter((entry): entry is GlobalCompactInsight => entry !== undefined);
}

export function composeRhythmNarrative(input: {
  readonly overview?: GlobalExpandedReadModel;
  readonly patterns?: GlobalExpandedReadModel;
  readonly breakdown?: GlobalExpandedReadModel;
  readonly evolution?: GlobalExpandedReadModel;
}): RhythmNarrative {
  const selectedInsights = insights(input.overview);
  const primary = selectedInsights[0];
  const primaryRow = primary === undefined
    ? undefined
    : input.overview?.rows.find((row) => row.entityRef !== undefined && primary.entityRefs.includes(row.entityRef));
  const primaryMomentRef = primary?.entityRefs.find((entityRef) => entityRef.startsWith("moment:"));
  const habits = input.patterns?.rows
    .filter((row) => row.typedMeasure?.kind === "MONEY" && row.activityCostProfile !== undefined)
    .slice(0, 3) ?? [];
  const moments = input.breakdown?.rows
    .filter((row) => row.typedMeasure?.kind === "MONEY" && row.entityRef !== primaryMomentRef)
    .slice(0, 3) ?? [];
  const changes = insights(input.evolution).filter((insight) => insight.kind === "M3_CERTIFIED_TRANSFORMATION");
  const relationships = selectedInsights.filter((insight) => insight.kind === "M5_MATERIAL_ROBUST_ASSOCIATION");
  return {
    ...(primary === undefined ? {} : { primary }),
    ...(primaryRow === undefined ? {} : { primaryRow }),
    habits,
    moments,
    changes,
    relationships,
  };
}
