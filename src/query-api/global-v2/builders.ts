import { canonicalSerializeGlobal } from "../../core/global-v2";
import {
  InsightSelectionEngine,
  type GlobalInsightCandidate,
  type GlobalSelectedInsight,
} from "../../analytics/global-v2/insight-selection";
import type { GlobalPublicationDecision } from "../../analytics/global-v2/publication";
import { parseGlobalInitialReadModel, parseGlobalModuleCompactReadModel } from "./schemas";
import {
  globalPrimaryModuleCatalog,
  type GlobalCompactKpi,
  type GlobalCompactQuality,
  type GlobalDetailEntry,
  type GlobalInitialReadModel,
  type GlobalModuleCapability,
  type GlobalModuleCompactReadModel,
  type GlobalPrimaryModuleKey,
  type GlobalReadModelPublicationMeta,
  type GlobalReadModelResourceMeta,
} from "./types";

export const GLOBAL_COMPACT_PAYLOAD_BUDGET_BYTES = 24 * 1024;
export const GLOBAL_INITIAL_PAYLOAD_BUDGET_BYTES = 16 * 1024;

function canonicalBy<T>(values: readonly T[], identity: (value: T) => string, label: string): readonly T[] {
  const result = [...values].sort((left, right) => identity(left).localeCompare(identity(right)));
  const identities = result.map(identity);
  if (new Set(identities).size !== identities.length) throw new TypeError(`${label}_DUPLICATE`);
  return result;
}

function toCompactInsight(selected: GlobalSelectedInsight) {
  return {
    insightId: selected.insightId,
    phenomenonId: selected.materiality.phenomenonId,
    kind: selected.kind,
    titleKey: selected.titleKey,
    statementKey: selected.statementKey,
    ...(selected.primaryMetricRef === undefined ? {} : { primaryMetricRef: selected.primaryMetricRef }),
    ...(selected.comparisonRef === undefined ? {} : { comparisonRef: selected.comparisonRef }),
    entityRefs: selected.supportingContext.entityRefs,
    evidenceRefs: selected.supportingContext.evidenceRefs,
    detailRefs: selected.supportingContext.detailRefs,
    editorialRank: selected.editorialRank,
  };
}

export type GlobalModuleCompactBuilderInput = {
  readonly moduleKey: GlobalPrimaryModuleKey;
  readonly publicationDecision: GlobalPublicationDecision;
  readonly insightCandidates: readonly GlobalInsightCandidate[];
  readonly kpis: readonly GlobalCompactKpi[];
  readonly quality: GlobalCompactQuality;
  readonly capabilities: readonly GlobalModuleCapability[];
  readonly detailEntries: readonly GlobalDetailEntry[];
  readonly publicationMeta: GlobalReadModelPublicationMeta;
  readonly resourceMeta: GlobalReadModelResourceMeta;
};

/** Projects already-qualified analytical output. It never derives an analytical value. */
export function buildGlobalModuleCompactReadModel(input: GlobalModuleCompactBuilderInput): GlobalModuleCompactReadModel {
  const catalog = globalPrimaryModuleCatalog.find((entry) => entry.moduleKey === input.moduleKey);
  if (catalog === undefined) throw new TypeError("GLOBAL_MODULE_UNKNOWN");
  if (input.publicationDecision.analyticsRevision !== String(input.publicationMeta.revision)) throw new TypeError("GLOBAL_MODULE_ANALYTICS_REVISION_MISMATCH");
  if (input.publicationDecision.sectionKey !== `module:${input.moduleKey}`) throw new TypeError("GLOBAL_MODULE_PUBLICATION_DECISION_MISMATCH");

  const moduleCandidates = input.insightCandidates.filter((candidate) => candidate.moduleKey === input.moduleKey);
  if (moduleCandidates.length !== input.insightCandidates.length) throw new TypeError("GLOBAL_MODULE_FOREIGN_INSIGHT");
  const selection = new InsightSelectionEngine().select({ candidates: moduleCandidates, limit: input.publicationDecision.visibility === "VISIBLE" ? 1 : 0 });
  const primaryInsight = selection.selectedInsights[0] === undefined ? undefined : toCompactInsight(selection.selectedInsights[0]);
  const kpis = input.publicationDecision.visibility === "VISIBLE"
    ? canonicalBy(input.kpis, (entry) => entry.kpiId, "GLOBAL_COMPACT_KPI")
    : [];
  if (kpis.length > 3) throw new TypeError("GLOBAL_COMPACT_KPI_LIMIT");
  if (primaryInsight !== undefined && kpis.some((kpi) => kpi.phenomenonId !== primaryInsight.phenomenonId)) {
    throw new TypeError("GLOBAL_KPI_INTRODUCES_SECOND_PHENOMENON");
  }
  const model: GlobalModuleCompactReadModel = {
    kind: "global_module_compact",
    schemaVersion: "global-module-compact@v1",
    moduleKey: input.moduleKey,
    resource: catalog.resource,
    order: catalog.order,
    visibility: input.publicationDecision.visibility,
    ...(input.publicationDecision.qualification === undefined ? {} : { qualification: input.publicationDecision.qualification }),
    ...(input.publicationDecision.reasonCode === undefined ? {} : { reasonCode: input.publicationDecision.reasonCode }),
    ...(input.publicationDecision.placeholder === undefined ? {} : { placeholder: input.publicationDecision.placeholder }),
    ...(primaryInsight === undefined ? {} : { primaryInsight }),
    kpis,
    quality: {
      ...input.quality,
      limitationCodes: canonicalBy(input.quality.limitationCodes, (value) => value, "GLOBAL_LIMITATION"),
      evidenceRefs: canonicalBy(input.quality.evidenceRefs, (value) => value, "GLOBAL_EVIDENCE"),
    },
    capabilities: canonicalBy(input.capabilities.map((capability) => ({
      ...capability,
      reasonCodes: canonicalBy(capability.reasonCodes, (value) => value, "GLOBAL_CAPABILITY_REASON"),
    })), (entry) => entry.capabilityId, "GLOBAL_CAPABILITY"),
    detailEntries: canonicalBy(input.detailEntries, (entry) => entry.entryId, "GLOBAL_DETAIL_ENTRY"),
    publicationMeta: input.publicationMeta,
    resourceMeta: { ...input.resourceMeta, policyVersions: Object.fromEntries(Object.entries(input.resourceMeta.policyVersions).sort(([left], [right]) => left.localeCompare(right))) },
  };
  const parsed = parseGlobalModuleCompactReadModel(model);
  if (new TextEncoder().encode(JSON.stringify(parsed)).byteLength > GLOBAL_COMPACT_PAYLOAD_BUDGET_BYTES) throw new TypeError("GLOBAL_COMPACT_PAYLOAD_BUDGET_EXCEEDED");
  return parsed;
}

export function globalPublicationCoherenceKey(meta: GlobalReadModelPublicationMeta): string {
  return canonicalSerializeGlobal({
    publicationId: meta.publicationId,
    revision: meta.revision,
    factsHash: meta.factsHash,
    generatedAt: meta.generatedAt,
    profileId: meta.profileId,
    manifestHash: meta.manifestHash,
  });
}

export function assertGlobalReadModelPublicationCoherence(models: readonly GlobalModuleCompactReadModel[]): void {
  if (models.length === 0) throw new TypeError("GLOBAL_PAGE_HAS_NO_MODULE");
  if (new Set(models.map((model) => globalPublicationCoherenceKey(model.publicationMeta))).size !== 1) {
    throw new TypeError("GLOBAL_MIXED_PUBLICATION_GENERATIONS");
  }
}

export function buildGlobalInitialReadModel(input: {
  readonly modules: readonly GlobalModuleCompactReadModel[];
  readonly capabilities: readonly GlobalModuleCapability[];
  readonly resourceMeta: GlobalReadModelResourceMeta;
}): GlobalInitialReadModel {
  assertGlobalReadModelPublicationCoherence(input.modules);
  const byModule = new Map(input.modules.map((module) => [module.moduleKey, module]));
  if (byModule.size !== globalPrimaryModuleCatalog.length) throw new TypeError("GLOBAL_INITIAL_MODULE_SET_INCOMPLETE");
  const model: GlobalInitialReadModel = {
    kind: "global_initial",
    schemaVersion: "global-initial@v1",
    navigation: globalPrimaryModuleCatalog.map((entry) => {
      const module = byModule.get(entry.moduleKey);
      if (module === undefined) throw new TypeError("GLOBAL_INITIAL_MODULE_SET_INCOMPLETE");
      return {
        moduleKey: entry.moduleKey,
        resource: entry.resource,
        order: entry.order,
        visibility: module.visibility,
        ...(module.qualification === undefined ? {} : { qualification: module.qualification }),
        ...(module.reasonCode === undefined ? {} : { reasonCode: module.reasonCode }),
      };
    }),
    capabilities: canonicalBy(input.capabilities.map((capability) => ({ ...capability, reasonCodes: canonicalBy(capability.reasonCodes, (value) => value, "GLOBAL_CAPABILITY_REASON") })), (entry) => entry.capabilityId, "GLOBAL_CAPABILITY"),
    publicationMeta: input.modules[0].publicationMeta,
    resourceMeta: { ...input.resourceMeta, policyVersions: Object.fromEntries(Object.entries(input.resourceMeta.policyVersions).sort(([left], [right]) => left.localeCompare(right))) },
  };
  const parsed = parseGlobalInitialReadModel(model);
  if (new TextEncoder().encode(JSON.stringify(parsed)).byteLength > GLOBAL_INITIAL_PAYLOAD_BUDGET_BYTES) throw new TypeError("GLOBAL_INITIAL_PAYLOAD_BUDGET_EXCEEDED");
  return parsed;
}

export const globalPrimaryReadModelBuilders = Object.freeze(Object.fromEntries(
  globalPrimaryModuleCatalog.map((entry) => [entry.resource, (input: Omit<GlobalModuleCompactBuilderInput, "moduleKey">) => buildGlobalModuleCompactReadModel({ ...input, moduleKey: entry.moduleKey })]),
));
