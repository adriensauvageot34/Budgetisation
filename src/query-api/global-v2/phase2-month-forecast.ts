import { createRuntimeSchema } from "../../core/validation";

export const phase2MonthForecastResourceDefinition = Object.freeze({
  resource: "phase2_month_forecast",
  capabilityId: "PHASE2_MONTH_FORECAST",
  group: "exploration",
  paramsKind: "target_month",
  family: "global_exploration",
  schemaVersion: "phase2-month-forecast@v1",
  availability: "AVAILABLE",
} as const);

const record = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label}_INVALID`);
  return value as Record<string, unknown>;
};
const text = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${label}_INVALID`);
  return value;
};
const amount = (value: unknown, label: string): void => {
  if (value !== null && (typeof value !== "string" || !/^-?\d+(?:\.\d{1,2})?$/u.test(value))) throw new TypeError(`${label}_INVALID`);
};
const range = (value: unknown, label: string): void => {
  const entry = record(value, label);
  for (const key of ["low", "central", "high"]) amount(entry[key], `${label}.${key}`);
};

/** A forecast snapshot is the engine result plus the existing Global generation envelope. */
export const phase2MonthForecastReadModelSchema = createRuntimeSchema((value: unknown) => {
  const payload = record(value, "Phase2MonthForecast");
  const meta = record(payload.meta, "ForecastMeta");
  const targetMonth = text(meta.targetMonth, "targetMonth");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(targetMonth)
    || !Number.isSafeInteger(meta.sourceRevision) || !Number.isSafeInteger(meta.analyticsRevision)
    || meta.certificationStatus !== "PROVISIONAL") throw new TypeError("FORECAST_META_INVALID");
  const publication = record(payload.publicationMeta, "publicationMeta");
  const resource = record(payload.resourceMeta, "resourceMeta");
  if (text(meta.sourcePublicationId, "sourcePublicationId") !== text(publication.publicationId, "publicationId")
    || meta.analyticsRevision !== publication.revision) throw new TypeError("FORECAST_PUBLICATION_META_MISMATCH");
  for (const key of ["factsHash", "manifestHash"]) text(publication[key], `publicationMeta.${key}`);
  for (const key of ["contractVersion", "methodSignature", "resourceInputHash"]) text(resource[key], `resourceMeta.${key}`);
  record(resource.policyVersions, "resourceMeta.policyVersions");
  const components = payload.components;
  if (!Array.isArray(components)) throw new TypeError("FORECAST_COMPONENTS_INVALID");
  for (const component of components) {
    const entry = record(component, "ForecastComponent");
    range(entry, "ForecastComponent");
    text(entry.key, "component.key");
    text(entry.ownerAuthority, "component.ownerAuthority");
    if (!Array.isArray(entry.provenance) || !entry.provenance.every((ref) => typeof ref === "string")
      || !Array.isArray(entry.limitations) || !Array.isArray(entry.replaces)) throw new TypeError("FORECAST_COMPONENT_EVIDENCE_INVALID");
  }
  for (const key of ["income", "obligations", "economicCost", "freeToSpend"]) range(payload[key], key);
  const cash = record(payload.cash, "cash");
  range(cash.grossBeforeUnconfirmedFunding, "cash.gross");
  range(cash.afterPotentialBenefit, "cash.afterBenefit");
  const events = record(payload.events, "events");
  if (events.knowledgeState !== "UNKNOWN" || events.eventDelta !== null) throw new TypeError("FORECAST_EVENT_UNKNOWN_INVALID");
  const available = record(payload.availableNow, "availableNow");
  if (available.status !== "UNAVAILABLE" || available.value !== null) throw new TypeError("FORECAST_OPENING_BALANCE_INVALID");
  if (!Array.isArray(payload.limitations)) throw new TypeError("FORECAST_LIMITATIONS_INVALID");
  if (payload.referencePlan !== undefined) {
    const plan = record(payload.referencePlan, "ForecastReferencePlan");
    if (plan.targetMonth !== targetMonth || !Array.isArray(plan.necessary) || !Array.isArray(plan.flexible))
      throw new TypeError("FORECAST_REFERENCE_PLAN_INVALID");
    for (const item of [...plan.necessary, ...plan.flexible]) {
      const part = record(item, "ForecastReferenceComponent");
      text(part.key, "reference.key");
      text(part.method, "reference.method");
      range(part, "ForecastReferenceComponent");
      if (!Number.isSafeInteger(part.observationCount) || (part.observationCount as number) < 0
        || !Array.isArray(part.provenance)) throw new TypeError("FORECAST_REFERENCE_PROVENANCE_INVALID");
    }
    range(plan.necessaryTotal, "necessaryTotal");
    range(plan.flexibleTotal, "flexibleTotal");
    record(plan.estimatedDays, "estimatedDays");
  }
  return value;
});
