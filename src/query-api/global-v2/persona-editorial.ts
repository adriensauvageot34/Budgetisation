/** Published, generation-pinned Persona editorial artifact. No client-side owner joins. */
export type EditorialPeriod = { readonly first: string; readonly last: string } | null;
export type EditorialSubscription = {
  readonly firstObservedAt: string | null;
  readonly lastObservedAt: string | null;
  readonly observedPaymentCount: number;
  readonly observedCumulativeCost: string;
  readonly typicalPayment: string | null;
  readonly cadence: string | null;
  readonly lifecycle: string | null;
  readonly usageDoesNotEstablishPayer: boolean;
};
export type EditorialProject = {
  readonly purchaseCount: number;
  readonly period: EditorialPeriod;
  readonly grossCost: string;
  readonly linkedRefund: string;
  readonly netCost: string;
  readonly netCertifiedByRefundLink: boolean;
};
export type EditorialMeal = {
  readonly directPurchaseCount: number;
  readonly directObservedCost: string;
  readonly m2AnnualCost: string | null;
  readonly anchorPurchaseCount: number;
  readonly anchorTypicalPurchase: string | null;
  readonly anchorPresence: { readonly label: string; readonly presenceDays: number; readonly period: EditorialPeriod } | null;
  readonly presenceIsNotPurchase: boolean;
  readonly merchantHabitSummary?: { readonly merchant: string; readonly purchaseCount: number; readonly period: EditorialPeriod; readonly typicalPurchase: string | null; readonly observedCost: string; readonly monthlyObservedCost: string | null; readonly monthlyPurchaseRate: number | null; readonly annualObservedCost: string | null; readonly monetaryBasis: "DIRECT_OBSERVED_PURCHASES_NO_PAYER_INFERENCE" };
  readonly allPurchaseHabitSummary?: { readonly purchaseCount: number; readonly period: EditorialPeriod; readonly typicalPurchase: string | null; readonly monthlyObservedCost: string | null; readonly monthlyPurchaseRate: number | null; readonly annualObservedCost: string | null; readonly merchants: readonly string[]; readonly monetaryBasis: "DIRECT_OBSERVED_PURCHASES_NO_PAYER_INFERENCE" };
};
export type EditorialPlacePresence = {
  readonly placeRef: string;
  readonly label: string;
  readonly presenceDays: number;
  readonly visitCount?: number;
  readonly monthlyPresenceDays: Readonly<Record<string, number>>;
  readonly monthlyPresenceSegments?: Readonly<Record<string, readonly boolean[]>>;
  readonly period: EditorialPeriod;
  readonly evidence: "CANONICAL_LOCATION_PRESENCE";
};
export type EditorialMobility = {
  readonly period: EditorialPeriod;
  readonly distinctDayCount: number;
  readonly eventCount: number;
  readonly distanceKm: string;
  readonly estimatedFuelCost: string;
  readonly estimatedFuelCostPerDay: string | null;
  readonly monetaryBasis: "ESTIMATED_FUEL_USAGE_NOT_PAID_AMOUNT";
  readonly support: string;
  readonly presenceFilter: string;
} | null;
export type EditorialOuting = { readonly date: string; readonly title: string; readonly place: string | null; readonly eventRef: string };
export type EditorialVehicleStorySummary = {
  readonly period: { readonly first: string; readonly last: string };
  readonly usage: {
    readonly distanceKm: string;
    readonly distinctUsageDays: number;
    readonly drivingHours: string | null;
    readonly estimatedFuelLiters: string;
    readonly estimatedFuelCost: string;
    readonly estimatedConsumptionL100Km: string | null;
    readonly legCount: number;
  };
  readonly tripProfile: {
    readonly shortTrips: { readonly thresholdKm: 5; readonly tripCount: number; readonly tripShare: string; readonly distanceKm: string; readonly distanceShare: string };
    readonly longTrips: { readonly thresholdKm: 50; readonly tripCount: number; readonly tripShare: string; readonly distanceKm: string; readonly distanceShare: string };
  };
  readonly insuranceEvolution: {
    readonly previousProvider: string | null;
    readonly previousMonthlyCost: string | null;
    readonly currentProvider: string | null;
    readonly currentMonthlyCost: string | null;
    readonly monthlyDifference: string | null;
    readonly evolution: "DECREASE" | "INCREASE" | "STABLE" | "UNKNOWN";
  };
  readonly maintenanceRhythm: { readonly monthlyCosts: Readonly<Record<string, string>>; readonly peakMonths: readonly string[] };
};
export type PersonaEditorialModel = {
  readonly schemaVersion: "persona-editorial@v2";
  readonly period: { readonly first: string; readonly certifiedThrough: string };
  readonly vehicle: {
    readonly householdVehicle: { readonly label: string; readonly scope: "HOUSEHOLD" } | null;
    readonly workUsageSummary: { readonly period: EditorialPeriod; readonly distinctDayCount: number; readonly distanceKm: string; readonly estimatedFuelCost: string; readonly estimatedFuelCostPerDay: string | null; readonly monetaryBasis: "ESTIMATED_FUEL_USAGE_NOT_PAID_AMOUNT"; readonly support: string } | null;
    readonly insuranceSummary: {
      readonly series: readonly { readonly provider: string; readonly lifecycle: string; readonly period: EditorialPeriod; readonly monthlyCost: string | null; readonly periodCost: string | null }[];
      readonly currentProvider: string | null;
      readonly currentMonthlyCost: string | null;
      readonly period: EditorialPeriod;
      readonly periodCost: string | null;
      readonly payerPersonId: string | null;
      readonly payerAuthority: "USER_VALIDATED" | "UNKNOWN";
    };
    readonly maintenanceSummary: { readonly scope: "HOUSEHOLD"; readonly period: EditorialPeriod; readonly operationCount: number; readonly totalIdentifiedCost: string; readonly fuelUsageExcluded: boolean };
    readonly storySummary: EditorialVehicleStorySummary;
    readonly maintenanceResponsibilityPersonId?: string | null;
    readonly nonFuelCostTotal: string | null;
    readonly nonFuelCostTotalReady: boolean;
  };
  readonly persons: readonly [
    {
      readonly personId: string;
      readonly work: { readonly onsiteDays: number; readonly remoteDays: number; readonly commute: { readonly mode: "PUBLIC_TRANSIT"; readonly directCost: string; readonly authority: "USER_VALIDATED" }; readonly workMeals: EditorialMeal };
      readonly personalUniverses: { readonly permit: { readonly scope: "PROJECT"; readonly period: EditorialPeriod; readonly cost: string; readonly monthlyCost?: Readonly<Record<string, string>>; readonly lessonsByMonth: Readonly<Record<string, number>>; readonly codeDates: readonly string[] }; readonly photo: EditorialProject; readonly musicHeadphones: EditorialProject; readonly googleAiPro: EditorialSubscription };
      readonly recurringHabits: {
        readonly chatGptUsage: "USER_VALIDATED";
        readonly qobuz: EditorialSubscription;
        readonly hairdresser: { readonly authority: "USER_VALIDATED_ROUTINE_WITH_OBSERVED_PLACE_PRESENCE"; readonly places: readonly EditorialPlacePresence[]; readonly observedPresenceDays: number; readonly personalAnnualCost: string | null; readonly typicalPersonalCost: string | null; readonly monthlyVisitEstimate?: string | null; readonly typicalVisitPrice?: string | null; readonly illustrativeAnnualCost?: string | null; readonly priceBasis?: "INDICATIVE_PRICE_NOT_PAYMENT" | null };
        readonly stylingWax: { readonly label: string; readonly repurchase: "USER_VALIDATED"; readonly price: string | null; readonly observedCadenceDays: number | null };
        readonly tobacco?: { readonly approximateMonthlyBudget: string | null; readonly sourceAnnualBudget: string | null; readonly authority: "USER_VALIDATED_APPROXIMATE_ATTRIBUTION" | "UNAVAILABLE" };
      };
      readonly socialLife: { readonly outingsWithoutPartnerParticipation: readonly EditorialOuting[]; readonly wording: "DE_SON_COTE" };
    },
    {
      readonly personId: string;
      readonly work: { readonly onsiteDays: number; readonly primaryWorkPlaces: readonly { readonly label: string; readonly presenceDays: number }[]; readonly workMeals: EditorialMeal; readonly professionalInterventions: { readonly eventCount: number; readonly contexts: readonly { readonly date: string; readonly title: string; readonly place: string | null }[] } };
      readonly personalUniverses: {
        readonly sunoFatherSong: EditorialProject & { readonly description: string; readonly recurrence: EditorialSubscription; readonly novemberPaymentExcluded: boolean };
        readonly products: readonly { readonly productKey: string; readonly label: string; readonly needKey: string; readonly purchaseCount: number; readonly typicalPrice: string | null; readonly medianGapDays: number | null; readonly period: EditorialPeriod }[];
      };
      readonly recurringHabits: {
        readonly netflix: EditorialSubscription;
        readonly max: EditorialSubscription;
        readonly videoObservedCost?: string;
        readonly cigarettesPerDay?: string | null;
        readonly vape: { readonly m2FirstActiveMonth: string | null; readonly firstDirectPurchaseAt: string | null; readonly directPurchases: readonly { readonly date: string; readonly amount: string }[]; readonly directObservedCost: string; readonly allocatedObservedCost: string; readonly allocationCount: number; readonly m2AnnualCost: string | null; readonly reconciledToM2: boolean | null; readonly equipmentCost?: string | null; readonly equipmentItemCount?: number };
      };
      readonly socialLife: {
        readonly fatherHome: readonly EditorialPlacePresence[];
        readonly maternalFamilyHome: readonly EditorialPlacePresence[];
        readonly amandine: readonly EditorialPlacePresence[];
        readonly friendVisits?: readonly { readonly placeRef: string; readonly label: string; readonly visitCount: number; readonly monthlyVisitSegments: Readonly<Record<string, readonly boolean[]>> }[];
        readonly familyVisitTotal?: number;
        readonly familyVisitsPerQuarter?: number;
        readonly fatherRoundTripFuelCost?: string | null;
        readonly motherRoundTripFuelCost?: string | null;
        readonly familyMobility?: EditorialMobility;
        readonly friendMobility?: EditorialMobility;
        readonly familyMobilityWithoutPartner: EditorialMobility;
        readonly friendMobilityWithoutPartner: EditorialMobility;
        readonly outingsWithoutPartnerParticipation: readonly EditorialOuting[];
        readonly wording: "DE_SON_COTE";
        readonly presenceIsNotTrip: true;
      };
    },
  ];
};
