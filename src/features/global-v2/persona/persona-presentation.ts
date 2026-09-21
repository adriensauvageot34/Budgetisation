import type { GlobalExpandedReadModel } from "@/query-api/global-v2";

type PersonaProfileOutput = NonNullable<GlobalExpandedReadModel["profile"]>;
type PersonaProfile = PersonaProfileOutput["profiles"][number];
type PersonaTrait = PersonaProfile["featuredTraits"][number];
type PersonaTraitChild = NonNullable<PersonaTrait["children"]>[number];
type PersonaTemporalStatus = NonNullable<PersonaTrait["temporalStatus"]>;
type PersonaMetricValue = NonNullable<PersonaTrait["metrics"]>[string];
type PersonalSubject = Extract<PersonaProfile["subject"], { readonly kind: "PERSON" }>;

export const PERSONA_PRESENTATION_VERSION = "persona_presentation@v1" as const;

export type PersonaEditorialGroup = "DAILY_RHYTHM" | "RECURRING_LIFE" | "PHASED_PROJECT";
export type PersonaRenderer = "RHYTHM" | "CREATIVE_UNIVERSE" | "BEAUTY_UNIVERSE" | "DRIVING_LICENSE" | "WORK_MOBILITY" | "DIGITAL_SUBSCRIPTION";
export type PersonaPresentationIcon = "RHYTHM" | "CREATIVE" | "BEAUTY" | "DRIVING" | "MOBILITY" | "DIGITAL";
export type PersonaChildrenStrategy = "NONE" | "KNOWN_CHILDREN";
export type PersonaTemporalTreatment = "NONE" | "STATUS" | "PHASE";
export type PersonaPresentationMetricFormat = "COUNT" | "DAYS" | "MONEY_EUR" | "DISTANCE_KM" | "DATE";

export type PersonaPresentationMetric = {
  readonly metricKey: string;
  readonly label: string;
  readonly value: PersonaMetricValue;
  readonly format: PersonaPresentationMetricFormat;
};

export type PersonaPresentationChild = {
  readonly traitId: string;
  readonly semanticKey: string;
  readonly title: string;
  readonly statusLabel?: string;
  readonly metrics: readonly PersonaPresentationMetric[];
};

export type PersonaPresentationBlock = {
  readonly traitId: string;
  readonly semanticKey: string;
  readonly renderer: PersonaRenderer;
  readonly icon: PersonaPresentationIcon;
  readonly editorialGroup: PersonaEditorialGroup;
  readonly title: string;
  readonly description: string;
  readonly engineRank: number;
  readonly portraitMarker: boolean;
  readonly statusLabel?: string;
  readonly metrics: readonly PersonaPresentationMetric[];
  readonly examples: readonly string[];
  readonly children: readonly PersonaPresentationChild[];
};

export type PersonaPortraitMarker = {
  readonly traitId: string;
  readonly title: string;
  readonly icon: PersonaPresentationIcon;
  readonly engineRank: number;
};

export type PersonaPresentationProfile = {
  readonly personId: PersonalSubject["personId"];
  readonly displayName?: string;
  readonly markers: readonly PersonaPortraitMarker[];
  readonly dailyRhythms: readonly PersonaPresentationBlock[];
  readonly recurringLife: readonly PersonaPresentationBlock[];
  readonly phasedProjects: readonly PersonaPresentationBlock[];
};

export type PersonaPresentationModel = {
  readonly version: typeof PERSONA_PRESENTATION_VERSION;
  readonly profiles: readonly PersonaPresentationProfile[];
};

type SemanticPresentation = {
  readonly title: string;
  readonly description: string;
  readonly icon: PersonaPresentationIcon;
  readonly editorialGroup: PersonaEditorialGroup;
  readonly renderer: PersonaRenderer;
  readonly metricsPolicy: readonly string[];
  readonly childrenStrategy: PersonaChildrenStrategy;
  readonly temporalTreatment: PersonaTemporalTreatment;
  readonly portraitMarker: boolean;
  readonly exampleLabels?: Readonly<Record<string, string>>;
  readonly requiresUsefulMetric?: boolean;
};

const noMetrics = Object.freeze([] as const);
const rhythmMetrics = Object.freeze(["occurrenceCount", "medianIntervalDays", "medianGapDays", "typicalAmount", "typicalPrice"] as const);
const mobilityMetrics = Object.freeze(["directCost", "distanceKm"] as const);
const projectMetrics = Object.freeze(["observedAmount", "committedAmount"] as const);
const productMetrics = Object.freeze(["typicalPrice", "occurrenceCount", "medianGapDays", "firstObservedDate", "lastObservedDate"] as const);

/** Exact semantic registry. It labels available traits; it never decides that a trait exists. */
export const PERSONA_SEMANTIC_PRESENTATION_REGISTRY_V1: Readonly<Record<string, SemanticPresentation>> = Object.freeze({
  "universe.beauty_and_care": {
    title: "Beauté & soins",
    description: "Les gestes de beauté et de soin réellement observés.",
    icon: "BEAUTY",
    editorialGroup: "RECURRING_LIFE",
    renderer: "BEAUTY_UNIVERSE",
    metricsPolicy: noMetrics,
    childrenStrategy: "KNOWN_CHILDREN",
    temporalTreatment: "STATUS",
    portraitMarker: true,
  },
  "universe.creative_projects": {
    title: "Projets créatifs",
    description: "Des pratiques créatives réunies dans un même univers.",
    icon: "CREATIVE",
    editorialGroup: "PHASED_PROJECT",
    renderer: "CREATIVE_UNIVERSE",
    metricsPolicy: noMetrics,
    childrenStrategy: "KNOWN_CHILDREN",
    temporalTreatment: "PHASE",
    portraitMarker: true,
    exampleLabels: { PHOTO: "Photo", MUSIC: "Musique", HOME_STUDIO: "Home studio" },
  },
});

type SemanticPatternPresentation = SemanticPresentation & { readonly matches: (semanticKey: string) => boolean };

/** Pattern entries cover person-scoped keys without branching on a display name. */
export const PERSONA_SEMANTIC_PATTERN_REGISTRY_V1: readonly SemanticPatternPresentation[] = Object.freeze([
  {
    matches: (key) => key.startsWith("driving_license."), title: "Permis de conduire", description: "Un projet de mobilité suivi dans le temps.",
    icon: "DRIVING", editorialGroup: "PHASED_PROJECT", renderer: "DRIVING_LICENSE", metricsPolicy: projectMetrics,
    childrenStrategy: "NONE", temporalTreatment: "PHASE", portraitMarker: true,
  },
  {
    matches: (key) => key.startsWith("mobility.work."), title: "Trajets de travail", description: "Le mode de transport renseigné pour les déplacements professionnels.",
    icon: "MOBILITY", editorialGroup: "DAILY_RHYTHM", renderer: "WORK_MOBILITY", metricsPolicy: mobilityMetrics,
    childrenStrategy: "NONE", temporalTreatment: "STATUS", portraitMarker: true,
  },
  {
    matches: (key) => key.startsWith("subscription.chatgpt."), title: "Usage de ChatGPT", description: "Un usage personnel explicitement renseigné.",
    icon: "DIGITAL", editorialGroup: "RECURRING_LIFE", renderer: "DIGITAL_SUBSCRIPTION", metricsPolicy: rhythmMetrics,
    childrenStrategy: "NONE", temporalTreatment: "STATUS", portraitMarker: true,
  },
  {
    matches: (key) => key.startsWith("activity:"), title: "Activité récurrente", description: "Une activité observée à plusieurs reprises dans le quotidien.",
    icon: "RHYTHM", editorialGroup: "DAILY_RHYTHM", renderer: "RHYTHM", metricsPolicy: rhythmMetrics,
    childrenStrategy: "NONE", temporalTreatment: "STATUS", portraitMarker: true, requiresUsefulMetric: true,
  },
  {
    matches: (key) => key.startsWith("routine:"), title: "Rythme observé", description: "Un rythme qui revient dans les observations du quotidien.",
    icon: "RHYTHM", editorialGroup: "DAILY_RHYTHM", renderer: "RHYTHM", metricsPolicy: rhythmMetrics,
    childrenStrategy: "NONE", temporalTreatment: "STATUS", portraitMarker: true, requiresUsefulMetric: true,
  },
]);

type ChildPresentation = { readonly matches: (semanticKey: string) => boolean; readonly title: string };
const childPresentationRegistry: readonly ChildPresentation[] = Object.freeze([
  { matches: (key) => key.startsWith("creative.photo."), title: "Photo" },
  { matches: (key) => key.startsWith("creative.music."), title: "Musique" },
  { matches: (key) => key.startsWith("creative.home_studio."), title: "Home studio" },
  { matches: (key) => key.startsWith("creative.projects."), title: "Pratiques créatives" },
  { matches: (key) => /^product-need:maquillage_.+_mascara$/u.test(key), title: "Mascara" },
  { matches: (key) => /^product-need:maquillage_.+_sourcils$/u.test(key), title: "Sourcils" },
  { matches: (key) => /^product-need:skincare_.+$/u.test(key), title: "Soin de la peau" },
  { matches: (key) => /^product-need:epilation_.+$/u.test(key), title: "Épilation" },
]);

type MetricPresentation = { readonly metricKey: string; readonly label: string; readonly format: PersonaPresentationMetricFormat };
const metricPresentationRegistry: readonly MetricPresentation[] = Object.freeze([
  { metricKey: "directCost", label: "Coût direct", format: "MONEY_EUR" },
  { metricKey: "observedAmount", label: "Montant engagé", format: "MONEY_EUR" },
  { metricKey: "committedAmount", label: "Montant engagé", format: "MONEY_EUR" },
  { metricKey: "typicalPrice", label: "Prix typique", format: "MONEY_EUR" },
  { metricKey: "typicalAmount", label: "Montant typique", format: "MONEY_EUR" },
  { metricKey: "occurrenceCount", label: "Occurrences", format: "COUNT" },
  { metricKey: "medianIntervalDays", label: "Intervalle typique", format: "DAYS" },
  { metricKey: "medianGapDays", label: "Intervalle typique", format: "DAYS" },
  { metricKey: "distanceKm", label: "Distance", format: "DISTANCE_KM" },
  { metricKey: "firstObservedDate", label: "Première observation", format: "DATE" },
  { metricKey: "lastObservedDate", label: "Dernière observation", format: "DATE" },
]);

function presentValue(value: PersonaMetricValue | undefined): PersonaMetricValue | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (normalized.length === 0 || ["UNKNOWN", "NOT_APPLICABLE", "CONFLICT"].includes(normalized)) return undefined;
  return normalized;
}

function presentationMetrics(metrics: PersonaTrait["metrics"], policy: readonly string[]): readonly PersonaPresentationMetric[] {
  if (metrics === undefined || policy.length === 0) return [];
  const presented: PersonaPresentationMetric[] = [];
  for (const definition of metricPresentationRegistry) {
    if (!policy.includes(definition.metricKey)) continue;
    const value = presentValue(metrics[definition.metricKey]);
    if (value === undefined) continue;
    presented.push({ metricKey: definition.metricKey, label: definition.label, value, format: definition.format });
    if (presented.length === 3) break;
  }
  return presented;
}

export function personaTemporalStatusLabel(status: PersonaTemporalStatus | undefined): string | undefined {
  if (status === "PROJECT") return "En cours";
  if (status === "HISTORICAL") return "Utilisé auparavant";
  if (status === "EMERGING") return "En évolution";
  if (status === "CHANGED") return "A évolué";
  return undefined;
}

function semanticPresentation(semanticKey: string): SemanticPresentation | undefined {
  return PERSONA_SEMANTIC_PRESENTATION_REGISTRY_V1[semanticKey]
    ?? PERSONA_SEMANTIC_PATTERN_REGISTRY_V1.find((entry) => entry.matches(semanticKey));
}

function presentChild(child: PersonaTraitChild): PersonaPresentationChild | undefined {
  const title = childPresentationRegistry.find((entry) => entry.matches(child.semanticKey))?.title;
  if (title === undefined) return undefined;
  const statusLabel = personaTemporalStatusLabel(child.temporalStatus);
  return {
    traitId: child.traitId, semanticKey: child.semanticKey, title,
    ...(statusLabel === undefined ? {} : { statusLabel }),
    metrics: presentationMetrics(child.metrics, productMetrics),
  };
}

function presentationExamples(trait: PersonaTrait, semantic: SemanticPresentation): readonly string[] {
  if (semantic.exampleLabels === undefined) return [];
  return (trait.qualifications ?? []).flatMap((qualification) => {
    const label = semantic.exampleLabels?.[qualification];
    return label === undefined ? [] : [label];
  });
}

/** Converts one selected engine trait only when an editorial renderer is registered. */
export function presentPersonaTrait(trait: PersonaTrait, engineRank: number): PersonaPresentationBlock | undefined {
  if (trait.scope !== "PERSONAL" || trait.subject.kind !== "PERSON") return undefined;
  const semantic = semanticPresentation(trait.semanticKey);
  if (semantic === undefined) return undefined;
  const metrics = presentationMetrics(trait.metrics, semantic.metricsPolicy);
  if (semantic.requiresUsefulMetric === true && metrics.length === 0) return undefined;
  const statusLabel = semantic.temporalTreatment === "NONE" ? undefined : personaTemporalStatusLabel(trait.temporalStatus);
  const children = semantic.childrenStrategy === "KNOWN_CHILDREN"
    ? (trait.children ?? []).flatMap((child) => {
      const presented = presentChild(child);
      return presented === undefined ? [] : [presented];
    })
    : [];
  return {
    traitId: trait.traitId, semanticKey: trait.semanticKey, renderer: semantic.renderer, icon: semantic.icon,
    editorialGroup: semantic.editorialGroup, title: semantic.title, description: semantic.description, engineRank, portraitMarker: semantic.portraitMarker,
    ...(statusLabel === undefined ? {} : { statusLabel }), metrics,
    examples: presentationExamples(trait, semantic), children,
  };
}

export type PersonaExpandedProfileSource = Pick<GlobalExpandedReadModel, "resource" | "moduleKey" | "sectionKey" | "profile" | "rows">;

function personaDisplayNames(source: PersonaExpandedProfileSource): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const row of source.rows) {
    if (!row.entityRef?.startsWith("person:")) continue;
    const personId = row.entityRef.slice("person:".length);
    const separator = row.labelKey.indexOf(" · ");
    const displayName = (separator < 0 ? row.labelKey : row.labelKey.slice(0, separator)).trim();
    if (personId.length > 0 && displayName.length > 0 && !names.has(personId)) names.set(personId, displayName);
  }
  return names;
}

function composeProfile(profile: PersonaProfile, displayName: string | undefined): PersonaPresentationProfile | undefined {
  if (profile.scope !== "PERSONAL" || profile.subject.kind !== "PERSON") return undefined;
  const markers: PersonaPortraitMarker[] = [];
  const dailyRhythms: PersonaPresentationBlock[] = [];
  const recurringLife: PersonaPresentationBlock[] = [];
  const phasedProjects: PersonaPresentationBlock[] = [];
  for (const [engineRank, trait] of profile.featuredTraits.entries()) {
    const block = presentPersonaTrait(trait, engineRank);
    if (block === undefined) continue;
    if (block.portraitMarker && markers.length < 4) markers.push({ traitId: block.traitId, title: block.title, icon: block.icon, engineRank });
    if (block.editorialGroup === "DAILY_RHYTHM") dailyRhythms.push(block);
    if (block.editorialGroup === "RECURRING_LIFE") recurringLife.push(block);
    if (block.editorialGroup === "PHASED_PROJECT") phasedProjects.push(block);
  }
  return { personId: profile.subject.personId, ...(displayName === undefined ? {} : { displayName }), markers, dailyRhythms, recurringLife, phasedProjects };
}

/** Presentation composition only: no trait selection, score, ranking, or analytical fallback. */
export function buildPersonaPresentationModel(source: PersonaExpandedProfileSource): PersonaPresentationModel {
  if (source.resource !== "analysis_global_personas_expanded" || source.moduleKey !== "PERSONAS" || source.sectionKey !== "OVERVIEW" || source.profile === undefined) {
    return { version: PERSONA_PRESENTATION_VERSION, profiles: [] };
  }
  const displayNames = personaDisplayNames(source);
  const profilesById = new Map<string, PersonaPresentationProfile>();
  for (const profile of source.profile.profiles) {
    if (profile.scope !== "PERSONAL" || profile.subject.kind !== "PERSON") continue;
    const personId = String(profile.subject.personId);
    const composed = composeProfile(profile, displayNames.get(personId));
    if (composed !== undefined) profilesById.set(personId, composed);
  }
  const profiles: PersonaPresentationProfile[] = [];
  for (const personId of displayNames.keys()) {
    const profile = profilesById.get(personId);
    if (profile === undefined) continue;
    profiles.push(profile);
    profilesById.delete(personId);
  }
  for (const profile of profilesById.values()) profiles.push(profile);
  return { version: PERSONA_PRESENTATION_VERSION, profiles };
}
