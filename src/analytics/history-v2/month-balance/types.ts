import type { Money } from "../../../core/money";
import type { LocalDate, YearMonth } from "../../../core/time";
import type {
  MetricValue,
  PartialMeaning,
  QualityEnvelope,
} from "../../../core/history-v2";

export type MaterialityDecision = {
  readonly absoluteThreshold: Money;
  readonly relativeThreshold: number;
  readonly absoluteSatisfied: boolean;
  readonly relativeSatisfied: boolean;
  readonly material: boolean;
};

export type MonthReferenceComparison = {
  readonly actual: Money;
  readonly reference: Money;
  readonly delta: Money;
  readonly relativeDelta?: number;
  readonly materiality: MaterialityDecision;
};

export type UsualZone = {
  readonly lowerBound: Money;
  readonly upperBound: Money;
  readonly tolerance: Money;
  readonly supportMonths: number;
  readonly supportLevel: "limited" | "sufficient";
};

export type HistoricalRank = {
  readonly rank: number;
  readonly universeCount: number;
  readonly presentation: "NEUTRAL" | "RANKED";
};

export type BankEconomyBridgeLineKind =
  | "BANK_OUTFLOW_EXCLUDED"
  | "ECONOMIC_EXPENSE_WITHOUT_BANK_OUTFLOW"
  | "REFUND_ECONOMIC_REATTACHMENT"
  | "CASH_USE"
  | "TIMING_REALLOCATION"
  | "OTHER_AUTHORIZED_ADJUSTMENT";

export type BankEconomyBridgeLine = {
  readonly lineId: string;
  readonly kind: BankEconomyBridgeLineKind;
  readonly label: string;
  readonly signedAmount: Money;
  readonly sourceRefs: readonly string[];
};

export type BankEconomyBridge = {
  readonly bankOutflows: Money;
  readonly actual: Money;
  readonly gap: Money;
  readonly lines: readonly BankEconomyBridgeLine[];
  readonly bridgeCalculatedActual: Money;
  readonly residual: Money;
  readonly visible: boolean;
  readonly result: MetricValue<Money>;
};

export type ImportedSummaryFreshness = "MISSING" | "CURRENT" | "STALE";

export type TypicalCompositionMonth = {
  readonly month: YearMonth;
  readonly complete: boolean;
  readonly amountsByStableId: Readonly<Record<string, Money>>;
};

export type TypicalCompositionBaseline = {
  readonly pivotMonthIds: readonly YearMonth[];
  readonly amountsByStableId: Readonly<Record<string, MetricValue<Money>>>;
  readonly total: MetricValue<Money>;
};

export type CategoryContribution = {
  readonly stableId: string;
  readonly label: string;
  readonly actual: Money;
  readonly baseline: MetricValue<Money>;
  readonly contribution: MetricValue<Money>;
};

export type CategoryExplanation = {
  readonly categoryDelta: Money;
  readonly drivers: readonly CategoryContribution[];
  readonly compensator?: CategoryContribution;
  readonly residual: MetricValue<Money>;
  readonly visible: boolean;
};

export type CategoryPreviewCandidate = {
  readonly categoryId: string;
  readonly amount: Money;
  readonly material: boolean;
  readonly lifecycle: "NEW" | "REAPPEARED" | "NONE" | "UNKNOWN";
  readonly classified: boolean;
};

export type CategoryPreviewSelection = {
  readonly selected: readonly CategoryPreviewCandidate[];
  readonly otherAmount: Money;
  readonly unclassifiedAmount: Money;
};

export type MerchantPurchaseDriverCandidate = {
  readonly explanationId: string;
  readonly kind: "MERCHANT" | "PURCHASE_EVENT";
  readonly label: string;
  readonly amount: Money;
  readonly contribution: Money;
  readonly subcategoryContribution: Money;
  readonly sameDirection: boolean;
  readonly currentCoverage: number;
  readonly pivotCoverage: number;
  readonly stableIdentity: boolean;
  readonly purchaseEventId?: string;
  readonly expenseEventIds: readonly string[];
  readonly merchantRank?: number;
};

export type StableIdentityHistory = {
  readonly stableId: string;
  readonly currentAmount: Money;
  readonly currentCategoryAmount: Money;
  readonly immediatelyPrior: readonly {
    readonly month: YearMonth;
    readonly complete: boolean;
    readonly amount: Money;
  }[];
  readonly olderKnownPositive: boolean;
  readonly expectedAnnualSeries?: boolean;
};

export type StableIdentityLifecycle = "NEW" | "REAPPEARED" | "NONE" | "UNKNOWN";

export type FrequencyTicketExplanation = {
  readonly availability: "KNOWN" | "UNKNOWN";
  readonly dominantFactor?: "FREQUENCY" | "TICKET" | "BOTH" | "NONE";
  readonly frequencyMaterial?: boolean;
  readonly ticketMaterial?: boolean;
  readonly frequencySeverity?: number;
  readonly ticketSeverity?: number;
  readonly quality?: QualityEnvelope;
};

export type NecessityClass = "INDISPENSABLE" | "CONSTRAINED" | "OPTIONAL";
export type BehaviorClass = "FIXED" | "VARIABLE";
export type LifeScopeClass = "CURRENT_LIFE" | "OUT_OF_DAILY";

export type SpendingComponentInput = {
  readonly componentKey: string;
  readonly amount: Money;
  readonly necessity?: NecessityClass;
  readonly behavior?: BehaviorClass;
  readonly lifeScope?: LifeScopeClass;
  readonly categoryId?: string;
  readonly subcategoryId?: string;
  readonly nonNegative: boolean;
};

export type SpendingBucket = {
  readonly key: string;
  readonly amount: Money;
  readonly shareOfActual?: number;
};

export type SpendingAxis = {
  readonly result: MetricValue<readonly SpendingBucket[]>;
  readonly classifiedAmount: Money;
  readonly unclassifiedAmount: Money;
  readonly coverageRatio?: number;
  readonly gapMaterial: boolean;
};

export type SpendingNatureMatrix = {
  readonly cells: readonly SpendingBucket[];
  readonly classifiedAmount: Money;
  readonly unclassifiedAmount: Money;
  readonly coverageRatio?: number;
  readonly immediateMargin: MetricValue<Money>;
  readonly mediumMargin: MetricValue<Money>;
};

export type MinimalFamily =
  | "OBLIGATIONS"
  | "VARIABLES_INDISPENSABLES"
  | "PROVISIONS"
  | "BESOINS_CONDITIONNELS";

export type MinimalComponentInput = {
  readonly componentId: string;
  readonly label: string;
  readonly family: MinimalFamily;
  readonly amount: Money;
};

export type MinimalPreviewFamily = {
  readonly family: MinimalFamily;
  readonly amount: Money;
  readonly examples: readonly MinimalComponentInput[];
};

export type MinimalPreview = {
  readonly total: Money;
  readonly families: readonly MinimalPreviewFamily[];
};

export type ActivityInterestInput = {
  readonly activityTypeKey: string;
  readonly occurrences: number;
  readonly referenceOccurrences?: number;
  readonly establishedReferenceAbsence?: boolean;
  readonly bestHighlightRank?: 1 | 2 | 3 | 4 | 5;
  readonly hasOtherNarrativeMoment: boolean;
  readonly priorityBand: 1 | 2 | 3 | 4 | 5;
  readonly qualifiedCostShare?: number;
  readonly qualifiedCostPartialMeaning?: PartialMeaning;
  readonly qualifiedCost?: Money;
};

export type ActivityInterestScore = {
  readonly activityTypeKey: string;
  readonly score: number;
  readonly frequencyPoints: number;
  readonly narrativePoints: number;
  readonly semanticPoints: number;
  readonly financialPoints: number;
  readonly intensityPoints: number;
  readonly occurrences: number;
  readonly priorityBand: 1 | 2 | 3 | 4 | 5;
  readonly bestHighlightRank?: 1 | 2 | 3 | 4 | 5;
  readonly absoluteFrequencyDelta: number;
  readonly qualifiedCost?: Money;
};

export type ActivityCostResolution = {
  readonly costKind: "CAUSAL" | "ASSOCIATED" | "NONE";
  readonly expenseEventIds: readonly string[];
  readonly amount: Money;
};

export type MomentSelectionInput = {
  readonly momentId: string;
  readonly highlightRank?: 1 | 2 | 3 | 4 | 5;
  readonly priorityBand: 1 | 2 | 3 | 4 | 5;
  readonly priorityWeight: number;
  readonly continuous: boolean;
  readonly livedDaysInMonth: number;
  readonly causalCost?: Money;
  readonly causalCostComparable: boolean;
  readonly startDate: LocalDate;
};

export type MomentMediaCandidate = {
  readonly mediaId: string;
  readonly momentId: string;
  readonly capturedAt: string;
  readonly role?: "COVER" | "FAVORITE" | "PRINCIPAL" | "OTHER";
  readonly direct: boolean;
};

export type MomentMediaSelection =
  | { readonly kind: "MEDIA"; readonly mediaId: string }
  | { readonly kind: "GRAPHIC_FALLBACK" };

export type PlaceSignificanceInput = {
  readonly placeId: string;
  readonly bestHighlightRank?: 1 | 2 | 3 | 4 | 5;
  readonly momentCount: number;
  readonly presenceDays: number;
  readonly activityTypeCount: number;
  readonly localizedAmount?: Money;
  readonly localizedShare?: number;
  readonly localizedCoverage?: number;
  readonly semanticKind: "TRAVEL_STAY" | "FAMILY_FRIEND" | "LEISURE_EVENT" | "HEALTH" | "OTHER";
  readonly routineKind: "HOME" | "REGULAR_WORK" | "OTHER_ROUTINE" | "NONE";
};

export type PlaceSignificanceScore = {
  readonly placeId: string;
  readonly score: number;
  readonly narrativePoints: number;
  readonly presencePoints: number;
  readonly activityPoints: number;
  readonly financePoints: number;
  readonly semanticBonus: number;
  readonly routinePenalty: number;
  readonly candidate: boolean;
  readonly bestHighlightRank?: 1 | 2 | 3 | 4 | 5;
  readonly momentCount: number;
  readonly presenceDays: number;
  readonly localizedAmount?: Money;
  readonly localizedComparable: boolean;
};

export type PlaceCandidateProof = {
  readonly placeId: string;
  readonly parentPlaceId?: string;
  readonly authority: "DIRECT_NARRATIVE" | "CANONICAL_VISIT" | "CANONICAL_FINANCE";
};

export type LocalizedAmountVisibility = {
  readonly localizedCoverage?: number;
  readonly cardAmount: MetricValue<Money>;
  readonly detailAmount: MetricValue<Money>;
};
