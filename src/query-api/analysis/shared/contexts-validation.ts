import {
  getContextCapability,
  isContextCapabilityId,
} from "../../../analytics/context";
import { isActiveMetricId } from "../../../analytics/production";
import {
  parseStrictRecord,
  requireProperty,
} from "../../../core/validation";
import { parseQueryCapabilities } from "../../capabilities";
import type { QueryResourceKey } from "../../request";
import { parseScopedMetricReadModel } from "../../read-models";
import type {
  AnalysisContextRow,
  AnalysisContextSection,
  AnalysisContextsReadModelBase,
} from "./types";

function parseLabel(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} doit être un libellé non vide.`);
  }
  return value;
}

function parseContextRow(value: unknown, capabilityId: string): AnalysisContextRow {
  const record = parseStrictRecord(
    value,
    ["key", "label", "metric"],
    "AnalysisContextRow",
  );
  const metric = parseScopedMetricReadModel(
    requireProperty(record, "metric", "AnalysisContextRow"),
  );
  const capability = getContextCapability(capabilityId);
  if (metric.metricId !== capability.metricId) {
    throw new TypeError("Context row MetricId est incohérente.");
  }
  if (
    metric.envelope.support !== undefined &&
    metric.envelope.support.unit !== capability.supportUnit
  ) {
    throw new TypeError("Context row SupportUnit est incohérente.");
  }
  return {
    key: parseLabel(requireProperty(record, "key", "AnalysisContextRow"), "AnalysisContextRow.key"),
    label: parseLabel(requireProperty(record, "label", "AnalysisContextRow"), "AnalysisContextRow.label"),
    metric,
  };
}

function parseContextSection(value: unknown): AnalysisContextSection {
  const candidate = parseStrictRecord(
    value,
    [
      "kind",
      "capabilityId",
      "dimension",
      "sourceGrains",
      "supportUnit",
      "overlappingContextsAdditivity",
      "rows",
      "reason",
    ],
    "AnalysisContextSection",
  );
  const kind = requireProperty(candidate, "kind", "AnalysisContextSection");
  const capabilityId = requireProperty(
    candidate,
    "capabilityId",
    "AnalysisContextSection",
  );
  if (!isContextCapabilityId(capabilityId)) {
    throw new TypeError("ContextCapabilityId est invalide.");
  }
  const capability = getContextCapability(capabilityId);
  if (kind === "unavailable") {
    const record = parseStrictRecord(
      value,
      ["kind", "capabilityId", "reason"],
      "UnavailableAnalysisContextSection",
    );
    if (capability.status.kind !== "deferred") {
      throw new TypeError("Un contexte Analytics actif ne peut être déclaré deferred.");
    }
    const reason = requireProperty(record, "reason", "AnalysisContextSection");
    if (reason !== capability.status.reason) {
      throw new TypeError("Context deferred reason est incohérente.");
    }
    return { kind, capabilityId, reason: capability.status.reason };
  }
  if (kind !== "available") {
    throw new TypeError("AnalysisContextSection.kind est invalide.");
  }
  const record = parseStrictRecord(
    value,
    [
      "kind",
      "capabilityId",
      "dimension",
      "sourceGrains",
      "supportUnit",
      "overlappingContextsAdditivity",
      "rows",
    ],
    "AvailableAnalysisContextSection",
  );
  if (capability.status.kind !== "available" || !isActiveMetricId(capability.metricId)) {
    throw new TypeError("Le contexte n'est pas publiable par le Metric Registry actif.");
  }
  if (
    requireProperty(record, "dimension", "AnalysisContextSection") !==
      capability.dimension ||
    requireProperty(record, "supportUnit", "AnalysisContextSection") !==
      capability.supportUnit ||
    requireProperty(
      record,
      "overlappingContextsAdditivity",
      "AnalysisContextSection",
    ) !== "non_additive"
  ) {
    throw new TypeError("Context dimension/grain policy est incohérente.");
  }
  const rawGrains = requireProperty(record, "sourceGrains", "AnalysisContextSection");
  if (
    !Array.isArray(rawGrains) ||
    rawGrains.length !== capability.sourceGrains.length ||
    rawGrains.some((grain, index) => grain !== capability.sourceGrains[index])
  ) {
    throw new TypeError("Context source grains sont incohérents.");
  }
  const rawRows = requireProperty(record, "rows", "AnalysisContextSection");
  if (!Array.isArray(rawRows)) {
    throw new TypeError("AnalysisContextSection.rows doit être un tableau.");
  }
  const rows = rawRows.map((row) => parseContextRow(row, capabilityId));
  const keys = rows.map(({ key }) => key);
  if (new Set(keys).size !== keys.length) {
    throw new TypeError("Analysis context rows ont des clés dupliquées.");
  }
  return {
    kind,
    capabilityId,
    dimension: capability.dimension,
    sourceGrains: capability.sourceGrains,
    supportUnit: capability.supportUnit,
    overlappingContextsAdditivity: "non_additive",
    rows,
  };
}

export function parseAnalysisContextsBase(
  value: unknown,
  expectedResource: QueryResourceKey,
): AnalysisContextsReadModelBase {
  const record = parseStrictRecord(
    value,
    ["sections", "capabilities"],
    "AnalysisContextsReadModelBase",
  );
  const rawSections = requireProperty(record, "sections", "AnalysisContextsReadModelBase");
  if (!Array.isArray(rawSections)) {
    throw new TypeError("Analysis contexts sections doit être un tableau.");
  }
  const sections = rawSections.map(parseContextSection);
  const ids = sections.map(({ capabilityId }) => capabilityId);
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id, index) => index > 0 && id <= ids[index - 1])
  ) {
    throw new TypeError("Analysis context sections doivent être uniques et ordonnées.");
  }
  const capabilities = parseQueryCapabilities(
      requireProperty(record, "capabilities", "AnalysisContextsReadModelBase"),
      expectedResource,
    );
  if (
    sections.some(
      (section) =>
        section.kind === "available" &&
        section.rows.some(
          ({ metric }) =>
            !capabilities.availableMeasures.includes(metric.metricId as never),
        ),
    )
  ) {
    throw new TypeError("Context rows dépassent les QueryCapabilities.");
  }
  return {
    sections,
    capabilities,
  };
}

