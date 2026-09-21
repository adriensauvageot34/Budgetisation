import type { GlobalExpandedReadModel } from "@/query-api/global-v2";

type PersonaProfileOutput = NonNullable<GlobalExpandedReadModel["profile"]>;
type PersonaProfile = PersonaProfileOutput["profiles"][number];
type PersonaTrait = PersonaProfile["featuredTraits"][number];
type PersonaTraitChild = NonNullable<PersonaTrait["children"]>[number];
type PersonaTraitKind = PersonaTrait["kind"];
type PersonaTemporalStatus = NonNullable<PersonaTrait["temporalStatus"]>;
type PersonaMetricValue = NonNullable<PersonaTrait["metrics"]>[string];
type PersonalSubject = Extract<PersonaProfile["subject"], { readonly kind: "PERSON" }>;

export const PERSONA_PRESENTATION_VERSION = "persona_presentation@v1" as const;

export type PersonaCardComponent =
  | "RoutineCard"
  | "HabitCard"
  | "UniverseCard"
  | "ProjectCard"
  | "MobilityCard"
  | "HouseholdOrganizationCard"
  | "BeautyUniverseCard"
  | "CreativeProjectsCard"
  | "DrivingLicenseCard"
  | "WorkMobilityCard";

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
  readonly kind: PersonaTraitKind;
  readonly statusLabel?: string;
  readonly metrics: readonly PersonaPresentationMetric[];
};

export type PersonaPresentationCard = {
  readonly traitId: string;
  readonly semanticKey: string;
  readonly kind: PersonaTraitKind;
  readonly component: PersonaCardComponent;
  readonly title: string;
  readonly description: string;
  /** Editorial hint only. Engine order remains authoritative in `cards`. */
  readonly presentationPriority: number;
  readonly engineRank: number;
  readonly statusLabel?: string;
  readonly metrics: readonly PersonaPresentationMetric[];
  readonly examples: readonly string[];
  readonly children: readonly PersonaPresentationChild[];
  /** Preserved for the future detail drawer; never use it to recompute the trait. */
  readonly trait: PersonaTrait;
};

export type PersonaPresentationProfile = {
  readonly personId: PersonalSubject["personId"];
  readonly displayName?: string;
  readonly cards: readonly PersonaPresentationCard[];
};

export type PersonaPresentationModel = {
  readonly version: typeof PERSONA_PRESENTATION_VERSION;
  readonly profiles: readonly PersonaPresentationProfile[];
};

type KindPresentation = {
  readonly component: PersonaCardComponent;
  readonly title: string;
  readonly description: string;
  readonly priority: number;
};

export const PERSONA_KIND_PRESENTATION_FALLBACKS: Readonly<Record<PersonaTraitKind, KindPresentation>> = Object.freeze({
  ROUTINE: { component: "RoutineCard", title: "Routine", description: "Un rythme qui structure le quotidien.", priority: 60 },
  HABIT: { component: "HabitCard", title: "Habitude", description: "Une habitude présente dans le quotidien.", priority: 50 },
  UNIVERSE: { component: "UniverseCard", title: "Univers", description: "Un ensemble de pratiques liées.", priority: 70 },
  PROJECT: { component: "ProjectCard", title: "Projet", description: "Un projet personnel suivi dans le temps.", priority: 65 },
  MOBILITY: { component: "MobilityCard", title: "Mobilité", description: "Une façon de se déplacer au quotidien.", priority: 55 },
  HOUSEHOLD_ORGANIZATION: { component: "HouseholdOrganizationCard", title: "Organisation", description: "Une organisation personnelle du quotidien.", priority: 40 },
});

type SemanticPresentation = Partial<KindPresentation> & {
  readonly exampleLabels?: Readonly<Record<string, string>>;
};

/** Presentation-only registry. Keys describe traits; they never decide whether a trait exists. */
export const PERSONA_SEMANTIC_PRESENTATION_REGISTRY_V1: Readonly<Record<string, SemanticPresentation>> = Object.freeze({
  "universe.beauty_and_care": {
    component: "BeautyUniverseCard",
    title: "Beauté & soins",
    description: "Les gestes de beauté et de soin réellement présents.",
    priority: 90,
  },
  "universe.creative_projects": {
    component: "CreativeProjectsCard",
    title: "Projets créatifs",
    description: "Les pratiques et projets créatifs réellement renseignés.",
    priority: 85,
    exampleLabels: { PHOTO: "Photo", MUSIC: "Musique", HOME_STUDIO: "Home studio" },
  },
  "driving_license.adrien": {
    component: "DrivingLicenseCard",
    title: "Permis de conduire",
    description: "Le suivi factuel du projet de permis.",
    priority: 75,
  },
  "mobility.work.adrien": {
    component: "WorkMobilityCard",
    title: "Trajets de travail",
    description: "Le mode de transport renseigné pour les trajets professionnels.",
    priority: 60,
  },
  "mobility.work.manon": {
    component: "WorkMobilityCard",
    title: "Trajets de travail",
    description: "Le mode de transport renseigné pour les trajets professionnels.",
    priority: 60,
  },
});

const semanticTitles: Readonly<Record<string, string>> = Object.freeze({
  "beauty.mascara": "Mascara",
  "beauty.brows": "Sourcils",
  "beauty.skincare": "Soin de la peau",
  "beauty.epilation": "Épilation",
  "product-need:maquillage_manon_mascara": "Mascara",
  "product-need:maquillage_manon_sourcils": "Sourcils",
  "product-need:skincare_manon_masque": "Soin de la peau",
  "product-need:epilation_manon": "Épilation",
  "creative.photo.adrien": "Photo",
  "creative.music.adrien": "Musique",
  "creative.home_studio.adrien": "Home studio",
  "creative.projects.adrien": "Pratiques créatives",
});

type MetricPresentation = {
  readonly metricKey: string;
  readonly label: string;
  readonly format: PersonaPresentationMetricFormat;
  readonly kinds: readonly PersonaTraitKind[];
};

const metricPresentationRegistry: readonly MetricPresentation[] = Object.freeze([
  { metricKey: "directCost", label: "Coût direct", format: "MONEY_EUR", kinds: ["MOBILITY"] },
  { metricKey: "observedAmount", label: "Montant engagé", format: "MONEY_EUR", kinds: ["PROJECT"] },
  { metricKey: "committedAmount", label: "Montant engagé", format: "MONEY_EUR", kinds: ["PROJECT"] },
  { metricKey: "typicalPrice", label: "Prix typique", format: "MONEY_EUR", kinds: ["HABIT", "ROUTINE"] },
  { metricKey: "typicalAmount", label: "Montant typique", format: "MONEY_EUR", kinds: ["HABIT", "ROUTINE"] },
  { metricKey: "occurrenceCount", label: "Occurrences", format: "COUNT", kinds: ["HABIT", "ROUTINE"] },
  { metricKey: "medianGapDays", label: "Intervalle typique", format: "DAYS", kinds: ["HABIT", "ROUTINE"] },
  { metricKey: "distanceKm", label: "Distance", format: "DISTANCE_KM", kinds: ["MOBILITY"] },
  { metricKey: "firstObservedDate", label: "Première observation", format: "DATE", kinds: ["HABIT", "ROUTINE"] },
  { metricKey: "lastObservedDate", label: "Dernière observation", format: "DATE", kinds: ["HABIT", "ROUTINE"] },
]);

function presentValue(value: PersonaMetricValue | undefined): PersonaMetricValue | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (normalized.length === 0 || ["UNKNOWN", "NOT_APPLICABLE", "CONFLICT"].includes(normalized)) return undefined;
  return normalized;
}

function presentationMetrics(kind: PersonaTraitKind, metrics: PersonaTrait["metrics"]): readonly PersonaPresentationMetric[] {
  if (metrics === undefined) return [];
  return metricPresentationRegistry.flatMap((definition) => {
    if (!definition.kinds.includes(kind)) return [];
    const value = presentValue(metrics[definition.metricKey]);
    return value === undefined ? [] : [{ metricKey: definition.metricKey, label: definition.label, value, format: definition.format }];
  }).slice(0, 3);
}

export function personaTemporalStatusLabel(status: PersonaTemporalStatus | undefined): string | undefined {
  if (status === "PROJECT") return "En cours";
  if (status === "HISTORICAL") return "Utilisé auparavant";
  if (status === "EMERGING") return "En évolution";
  if (status === "CHANGED") return "A évolué";
  return undefined;
}

function presentationTitle(semanticKey: string, kind: PersonaTraitKind): string {
  return PERSONA_SEMANTIC_PRESENTATION_REGISTRY_V1[semanticKey]?.title
    ?? semanticTitles[semanticKey]
    ?? PERSONA_KIND_PRESENTATION_FALLBACKS[kind].title;
}

function presentChild(child: PersonaTraitChild): PersonaPresentationChild {
  const statusLabel = personaTemporalStatusLabel(child.temporalStatus);
  return {
    traitId: child.traitId,
    semanticKey: child.semanticKey,
    title: presentationTitle(child.semanticKey, child.kind),
    kind: child.kind,
    ...(statusLabel === undefined ? {} : { statusLabel }),
    metrics: presentationMetrics(child.kind, child.metrics),
  };
}

function presentationExamples(trait: PersonaTrait, semantic: SemanticPresentation | undefined): readonly string[] {
  if (semantic?.exampleLabels === undefined) return [];
  return (trait.qualifications ?? []).flatMap((qualification) => {
    const label = semantic.exampleLabels?.[qualification];
    return label === undefined ? [] : [label];
  });
}

export function presentPersonaTrait(trait: PersonaTrait, engineRank: number): PersonaPresentationCard | undefined {
  if (trait.scope !== "PERSONAL" || trait.subject.kind !== "PERSON") return undefined;
  const fallback = PERSONA_KIND_PRESENTATION_FALLBACKS[trait.kind];
  const semantic = PERSONA_SEMANTIC_PRESENTATION_REGISTRY_V1[trait.semanticKey];
  const statusLabel = personaTemporalStatusLabel(trait.temporalStatus);
  return {
    traitId: trait.traitId,
    semanticKey: trait.semanticKey,
    kind: trait.kind,
    component: semantic?.component ?? fallback.component,
    title: semantic?.title ?? semanticTitles[trait.semanticKey] ?? fallback.title,
    description: semantic?.description ?? fallback.description,
    presentationPriority: semantic?.priority ?? fallback.priority,
    engineRank,
    ...(statusLabel === undefined ? {} : { statusLabel }),
    metrics: presentationMetrics(trait.kind, trait.metrics),
    examples: presentationExamples(trait, semantic),
    children: (trait.children ?? []).map(presentChild),
    trait,
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

const preferredProfileOrder = Object.freeze(["Adrien", "Manon"] as const);

/** UI-only column order. Missing profiles are never synthesized. */
export function orderPersonaPresentationProfiles(profiles: readonly PersonaPresentationProfile[]): readonly PersonaPresentationProfile[] {
  const ordered: PersonaPresentationProfile[] = [];
  const used = new Set<PersonaPresentationProfile["personId"]>();
  for (const displayName of preferredProfileOrder) {
    const profile = profiles.find((candidate) => candidate.displayName === displayName && !used.has(candidate.personId));
    if (profile === undefined) continue;
    ordered.push(profile);
    used.add(profile.personId);
  }
  for (const profile of profiles) {
    if (used.has(profile.personId)) continue;
    ordered.push(profile);
    used.add(profile.personId);
  }
  return ordered;
}

/** Maps the validated expanded Persona read model without selecting, grouping or ranking traits again. */
export function buildPersonaPresentationModel(source: PersonaExpandedProfileSource): PersonaPresentationModel {
  if (source.resource !== "analysis_global_personas_expanded"
    || source.moduleKey !== "PERSONAS"
    || source.sectionKey !== "OVERVIEW"
    || source.profile === undefined) {
    return { version: PERSONA_PRESENTATION_VERSION, profiles: [] };
  }
  const displayNames = personaDisplayNames(source);
  const profiles = source.profile.profiles.flatMap((profile) => {
    if (profile.scope !== "PERSONAL" || profile.subject.kind !== "PERSON") return [];
    const cards = profile.featuredTraits.flatMap((trait, engineRank) => {
      const card = presentPersonaTrait(trait, engineRank);
      return card === undefined ? [] : [card];
    });
    const displayName = displayNames.get(String(profile.subject.personId));
    return [{ personId: profile.subject.personId, ...(displayName === undefined ? {} : { displayName }), cards }];
  });
  return { version: PERSONA_PRESENTATION_VERSION, profiles };
}
