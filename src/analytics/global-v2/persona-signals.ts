import type { HouseholdId, PersonId } from "../../core/identity";
import type { Money } from "../../core/money";
import type { LocalDate } from "../../core/time";
import { parseContractVersion, type MethodVersion } from "../../core/versions";
import type { GlobalPersonaFamily } from "./persona";

export const PERSONA_SIGNAL_CONTRACT_VERSION = parseContractVersion("v1");

export const personaSignalTypeCatalog = Object.freeze([
  "PERSONAL_COST",
  "NEED",
  "ROUTINE",
  "PRODUCT_CYCLE",
  "MOMENT",
  "MOBILITY",
  "SHARED_ACTIVITY",
  "DIFFERENCE",
  "DECLARED",
] as const);

export const personaScopeCatalog = Object.freeze([
  "PERSONAL",
  "SHARED",
  "HOUSEHOLD",
] as const);

export const personaTraitKindCatalog = Object.freeze([
  "HABIT",
  "ROUTINE",
  "UNIVERSE",
  "PROJECT",
  "MOBILITY",
  "HOUSEHOLD_ORGANIZATION",
] as const);

export const personaDeclaredSignalActionCatalog = Object.freeze([
  "AFFIRM",
  "QUALIFY",
  "TEMPORAL_OVERRIDE",
  "NEGATE",
] as const);

export const personaClaimDimensionCatalog = Object.freeze([
  "FINANCE",
  "USAGE",
  "OWNERSHIP",
  "PARTICIPATION",
  "TEMPORALITY",
  "ORGANIZATION",
  "GENERAL",
] as const);

export type PersonaSignalType = (typeof personaSignalTypeCatalog)[number];
export type PersonaScope = (typeof personaScopeCatalog)[number];
export type PersonaTraitKind = (typeof personaTraitKindCatalog)[number];
export type PersonaDeclaredSignalAction = (typeof personaDeclaredSignalActionCatalog)[number];
export type PersonaClaimDimension = (typeof personaClaimDimensionCatalog)[number];

export type PersonaAuthority =
  | "USER_VALIDATED"
  | "CANONICAL_DB"
  | "OBSERVED"
  | "DERIVED";

export type PersonaKnowledgeStatus =
  | "OBSERVED"
  | "DERIVED"
  | "USER_VALIDATED"
  | "TO_CONFIRM";

export type PersonaTemporalStatus =
  | "STABLE"
  | "EMERGING"
  | "HISTORICAL"
  | "PROJECT"
  | "CHANGED"
  | "UNKNOWN";

export type PersonaSubject =
  | { readonly kind: "PERSON"; readonly personId: PersonId }
  | { readonly kind: "SHARED"; readonly personIds?: readonly [PersonId, PersonId] }
  | { readonly kind: "HOUSEHOLD"; readonly householdId?: HouseholdId };

export type PersonaScopedSubject =
  | { readonly subject: Extract<PersonaSubject, { readonly kind: "PERSON" }>; readonly scope: "PERSONAL" }
  | { readonly subject: Extract<PersonaSubject, { readonly kind: "SHARED" }>; readonly scope: "SHARED" }
  | { readonly subject: Extract<PersonaSubject, { readonly kind: "HOUSEHOLD" }>; readonly scope: "HOUSEHOLD" };

export type PersonaMetricValue = string | number;
export type PersonaMetrics = Readonly<Record<string, PersonaMetricValue>>;

type PersonaSignalFields = {
  readonly signalId: string;
  readonly semanticKey: string;
  readonly family?: GlobalPersonaFamily;
  readonly kind?: PersonaTraitKind;
  readonly authority?: PersonaAuthority;
  readonly knowledgeStatus?: PersonaKnowledgeStatus;
  readonly temporalStatus?: PersonaTemporalStatus;
  readonly evidenceRefs?: readonly string[];
  readonly limitations?: readonly string[];
  readonly metrics?: PersonaMetrics;
  readonly groupKey?: string;
  readonly context?: string;
  readonly validFrom?: LocalDate;
  readonly validTo?: LocalDate;
  readonly dimension?: PersonaClaimDimension;
  readonly sourceModule?: string;
  readonly methodVersion?: MethodVersion;
};

export type PersonaSignalBase = PersonaScopedSubject & PersonaSignalFields;

export type PersonalCostSignal = PersonaSignalBase & {
  readonly signalType: "PERSONAL_COST";
  readonly needKey?: string;
  readonly entityRef?: string;
  readonly observedAmount?: Money;
  readonly typicalAmount?: Money;
  readonly payerPersonId?: PersonId;
  readonly beneficiaryPersonId?: PersonId;
};

export type NeedSignal = PersonaSignalBase & {
  readonly signalType: "NEED";
  readonly needKey?: string;
  readonly entityRef?: string;
  readonly active?: boolean;
};

export type RoutineSignal = PersonaSignalBase & {
  readonly signalType: "ROUTINE";
  readonly pattern?: readonly string[];
};

export type ProductCycleSignal = PersonaSignalBase & {
  readonly signalType: "PRODUCT_CYCLE";
  readonly needKey?: string;
  readonly productKey?: string;
  readonly referenceChanged?: boolean;
};

export type MomentSignal = PersonaSignalBase & {
  readonly signalType: "MOMENT";
  readonly momentRef?: string;
};

export type MobilitySignal = PersonaSignalBase & {
  readonly signalType: "MOBILITY";
  readonly entityRef?: string;
  readonly mode?: string;
  readonly vehicleRef?: string;
};

export type SharedActivitySignal = PersonaSignalBase & {
  readonly signalType: "SHARED_ACTIVITY";
  readonly activityKey?: string;
  readonly upstreamUnitRefs?: readonly string[];
};

export type DifferenceSignal = PersonaSignalBase & {
  readonly signalType: "DIFFERENCE";
  readonly differenceRef?: string;
  readonly comparisonPersonIds?: readonly [PersonId, PersonId];
};

export type PersonaDeclaredValue = string | number | boolean | readonly string[];

export type DeclaredSignal = PersonaSignalBase & {
  readonly signalType: "DECLARED";
  readonly action: PersonaDeclaredSignalAction;
  readonly value?: PersonaDeclaredValue;
  readonly targetSemanticKeys?: readonly string[];
  readonly note?: string;
};

export type PersonaSignal =
  | PersonalCostSignal
  | NeedSignal
  | RoutineSignal
  | ProductCycleSignal
  | MomentSignal
  | MobilitySignal
  | SharedActivitySignal
  | DifferenceSignal
  | DeclaredSignal;

type PersonaTraitFields = {
  readonly kind: PersonaTraitKind;
  readonly family: GlobalPersonaFamily;
  readonly semanticKey: string;
  readonly authority?: PersonaAuthority;
  readonly authorities?: readonly PersonaAuthority[];
  readonly knowledgeStatus?: PersonaKnowledgeStatus;
  readonly temporalStatus?: PersonaTemporalStatus;
  readonly dimensions?: readonly PersonaClaimDimension[];
  readonly context?: string;
  readonly validFrom?: LocalDate;
  readonly validTo?: LocalDate;
  readonly signalRefs?: readonly string[];
  readonly evidenceRefs?: readonly string[];
  readonly sourceModules?: readonly string[];
  readonly limitations?: readonly string[];
  readonly qualifications?: readonly string[];
  readonly metrics?: PersonaMetrics;
  readonly groupKey?: string;
  readonly needKeys?: readonly string[];
  readonly entityRefs?: readonly string[];
};

export type PersonaTraitCandidate = PersonaScopedSubject & PersonaTraitFields & {
  readonly candidateId: string;
};

export type PersonaTraitChild = {
  readonly traitId: string;
  readonly semanticKey: string;
  readonly kind: PersonaTraitKind;
  readonly family: GlobalPersonaFamily;
  readonly temporalStatus?: PersonaTemporalStatus;
  readonly authorities: readonly PersonaAuthority[];
  readonly sourceModules: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly limitations: readonly string[];
  readonly metrics?: PersonaMetrics;
};

export type PersonaTraitExplanation = {
  readonly summaryCode: string;
  readonly reasonCodes: readonly string[];
  readonly authorities: readonly PersonaAuthority[];
  readonly sourceModules: readonly string[];
  readonly signalRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly limitations: readonly string[];
  readonly metrics?: PersonaMetrics;
  readonly children: readonly PersonaTraitChild[];
};

export type PersonaTraitSelection = {
  readonly featured: true;
  readonly reasonCodes: readonly string[];
  readonly methodVersion: MethodVersion;
};

export type PersonaTrait = PersonaScopedSubject & PersonaTraitFields & {
  readonly traitId: string;
  readonly summary?: string;
  readonly children?: readonly PersonaTraitChild[];
  readonly explanation?: PersonaTraitExplanation;
  readonly selection?: PersonaTraitSelection;
};

export type PersonaProfile = PersonaScopedSubject & {
  readonly allTraits: readonly PersonaTrait[];
  readonly featuredTraits: readonly PersonaTrait[];
  readonly limitations?: readonly string[];
};

export type PersonaProfileOutput = {
  readonly contractVersion: typeof PERSONA_SIGNAL_CONTRACT_VERSION;
  readonly methodVersion: MethodVersion;
  readonly profiles: readonly PersonaProfile[];
  readonly limitations?: readonly string[];
};
