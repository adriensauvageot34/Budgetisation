import {
  activeMetricIds,
  getMetricRegistryEntry,
  isActiveMetricId,
  type ActiveMetricId,
} from "../../../analytics/production";
import { parseYearMonth } from "../../../core/time";
import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  requireProperty,
} from "../../../core/validation";
import { parseQueryCapabilities, type QueryCapabilities } from "../../capabilities";
import { parseCursorPage } from "../../collections";
import {
  canonicalSerializeQueryParams,
  queryResourceKeys,
} from "../../request";
import { parseDisplayText } from "../shared";
import type {
  MetricCatalogCard,
  MetricCatalogCollectionReadModel,
  MetricCatalogPreviewReadModel,
  MetricMethodologyReadModel,
} from "./types";

const descriptions: Record<ActiveMetricId, string> = {
  economic_consumption_net_attributable: "Consommation économique nette attribuable au périmètre demandé.",
  typical_month_cost: "Valeur mensuelle typique issue de la fenêtre de référence Analytics.",
  minimal_month_cost: "Référence mensuelle composite : variable neutre éligible plus obligations et provisions officielles.",
  localized_spend: "Dépense économique nette attribuée à un lieu transactionnel canonique.",
  category_amount: "Montant économique net attribué à une catégorie canonique.",
  merchant_net_amount: "Montant économique net attribué à un marchand canonique.",
  life_scope_amount: "Montant économique net attribué à un contexte de vie canonique.",
  fixed_variable_amount: "Montant économique net réparti selon la nature Fixe / Variable canonique.",
  purchase_count: "Nombre d'actes d'achat canoniques distincts.",
  person_day_count: "Nombre de jours-personnes observés selon le Fact Layer.",
  place_visit_count: "Nombre de visites canoniques de lieu.",
  distinct_visit_days: "Nombre de jours civils distincts portant une visite canonique.",
  activity_frequency: "Nombre d'occurrences d'activité admissibles.",
  activity_causal_cost: "Somme économique nette canoniquement attribuée aux occurrences d'activité.",
  activity_causal_median_cost_per_occurrence: "Médiane des coûts causaux nets par occurrence qualifiée.",
  fuel_trip_estimate: "Estimation distincte du coût carburant selon les entrées disponibles.",
};

const formulas: Record<ActiveMetricId, string> = {
  economic_consumption_net_attributable: "Somme autoritaire des composantes économiques nettes dédupliquées.",
  typical_month_cost: "Médiane Analytics des mois admissibles de la fenêtre de référence.",
  minimal_month_cost: "neutral_variable_month_cost + mandatory_monthly_obligations_and_provisions, sans double compte.",
  localized_spend: "Agrégation des composantes nettes portant une attribution canonique de lieu.",
  category_amount: "Agrégation des composantes nettes portant la catégorie demandée.",
  merchant_net_amount: "Agrégation des composantes nettes portant le marchand demandé.",
  life_scope_amount: "Agrégation des composantes nettes portant le contexte de vie demandé.",
  fixed_variable_amount: "Agrégation exhaustive des composantes nettes par nature_fixe_variable ; les inconnues restent À déterminer.",
  purchase_count: "Comptage dédupliqué des fct_purchase_event.",
  person_day_count: "Comptage dédupliqué des fct_person_day.",
  place_visit_count: "Comptage dédupliqué des fct_place_visit.",
  distinct_visit_days: "Comptage distinct des dates civiles de fct_place_visit.",
  activity_frequency: "Comptage dédupliqué des fct_activity_occurrence admissibles.",
  activity_causal_cost: "Somme des coûts causaux qualifiés après déduplication par canonical_component_key.",
  activity_causal_median_cost_per_occurrence: "Médiane des coûts causaux nets connus ; indisponible sous 5 occurrences qualifiées.",
  fuel_trip_estimate: "Application de la méthode d'estimation Analytics publiée, sans dépense observée inventée.",
};

export function projectMetricMethodology(input: {
  readonly metricId: ActiveMetricId;
  readonly asOf: unknown;
  readonly capabilities: QueryCapabilities;
}): MetricMethodologyReadModel {
  const definition = getMetricRegistryEntry(input.metricId);
  const reference = definition.referenceMethod === undefined
    ? undefined
    : {
        method: definition.referenceMethod,
        ...(definition.referenceWindow === undefined
          ? {}
          : { requestedPeriods: definition.referenceWindow.requestedPeriods }),
      };
  return {
    metricId: definition.metricId,
    asOf: parseYearMonth(input.asOf),
    userName: definition.semanticName,
    description: descriptions[input.metricId],
    methodVersion: definition.methodVersion,
    grain: [...definition.grain],
    sourceFact: [...definition.sourceFact],
    formulaDescription: formulas[input.metricId],
    dateBasis: definition.dateBasis,
    ...(reference === undefined ? {} : { reference }),
    support: definition.supportPolicy,
    provenanceRule: definition.provenanceRule,
    additivity: definition.additivity,
    compatibleDimensions: [...definition.dimensions],
    capabilities: input.capabilities,
  };
}

function assertCanonicalEqual(actual: unknown, expected: unknown, name: string): void {
  if (
    canonicalSerializeQueryParams({ value: actual }) !==
    canonicalSerializeQueryParams({ value: expected })
  ) {
    throw new TypeError(`${name} diverge du Metric Registry.`);
  }
}

export function parseMetricMethodologyReadModel(value: unknown): MetricMethodologyReadModel {
  const record = parseStrictRecord(
    value,
    ["metricId", "asOf", "userName", "description", "methodVersion", "grain", "sourceFact", "formulaDescription", "dateBasis", "reference", "support", "provenanceRule", "additivity", "compatibleDimensions", "capabilities"],
    "MetricMethodologyReadModel",
  );
  const metricId = requireProperty(record, "metricId", "MetricMethodologyReadModel");
  if (!isActiveMetricId(metricId)) throw new TypeError("Metric methodology exige une MetricId active.");
  const projected = projectMetricMethodology({
    metricId,
    asOf: requireProperty(record, "asOf", "MetricMethodologyReadModel"),
    capabilities: parseQueryCapabilities(
      requireProperty(record, "capabilities", "MetricMethodologyReadModel"),
      queryResourceKeys.metricMethodology,
    ),
  });
  for (const key of [
    "userName", "description", "methodVersion", "grain", "sourceFact", "formulaDescription",
    "dateBasis", "support", "provenanceRule", "additivity", "compatibleDimensions",
  ] as const) {
    assertCanonicalEqual(record[key], projected[key], `MetricMethodologyReadModel.${key}`);
  }
  if (hasOwn(record, "reference") !== (projected.reference !== undefined)) {
    throw new TypeError("MetricMethodologyReadModel.reference diverge du registre.");
  }
  if (projected.reference !== undefined) assertCanonicalEqual(record.reference, projected.reference, "reference");
  return projected;
}

export function projectMetricCatalogCard(metricId: ActiveMetricId): MetricCatalogCard {
  const definition = getMetricRegistryEntry(metricId);
  return { metricId, userName: definition.semanticName, outputKind: definition.outputKind };
}

function parseMetricCatalogCard(value: unknown): MetricCatalogCard {
  const record = parseStrictRecord(value, ["metricId", "userName", "outputKind"], "MetricCatalogCard");
  const metricId = requireProperty(record, "metricId", "MetricCatalogCard");
  if (!isActiveMetricId(metricId)) throw new TypeError("MetricCatalogCard.metricId est inactive.");
  const projected = projectMetricCatalogCard(metricId);
  assertCanonicalEqual(record.userName, projected.userName, "MetricCatalogCard.userName");
  assertCanonicalEqual(record.outputKind, projected.outputKind, "MetricCatalogCard.outputKind");
  return projected;
}

export function parseMetricCatalogPreviewReadModel(value: unknown): MetricCatalogPreviewReadModel {
  const record = parseStrictRecord(value, ["items", "capabilities"], "MetricCatalogPreviewReadModel");
  const rawItems = requireProperty(record, "items", "MetricCatalogPreviewReadModel");
  if (!Array.isArray(rawItems) || rawItems.length > activeMetricIds.length) {
    throw new TypeError("MetricCatalogPreviewReadModel.items est invalide.");
  }
  const items = rawItems.map(parseMetricCatalogCard);
  if (new Set(items.map(({ metricId }) => metricId)).size !== items.length) {
    throw new TypeError("MetricCatalogPreviewReadModel contient un doublon.");
  }
  return {
    items,
    capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", "MetricCatalogPreviewReadModel"), queryResourceKeys.metricCatalogPreview),
  };
}

export function parseMetricCatalogCollectionReadModel(value: unknown): MetricCatalogCollectionReadModel {
  const record = parseStrictRecord(value, ["page", "capabilities"], "MetricCatalogCollectionReadModel");
  return {
    page: parseCursorPage(requireProperty(record, "page", "MetricCatalogCollectionReadModel"), parseMetricCatalogCard),
    capabilities: parseQueryCapabilities(requireProperty(record, "capabilities", "MetricCatalogCollectionReadModel"), queryResourceKeys.metricCatalogCollection),
  };
}

export const metricMethodologyReadModelSchema = createRuntimeSchema(parseMetricMethodologyReadModel);
export const metricCatalogPreviewReadModelSchema = createRuntimeSchema(parseMetricCatalogPreviewReadModel);
export const metricCatalogCollectionReadModelSchema = createRuntimeSchema(parseMetricCatalogCollectionReadModel);
