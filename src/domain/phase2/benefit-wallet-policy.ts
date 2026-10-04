export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type BenefitWalletUsagePolicy = Readonly<{ dailyCap: string; currency: "EUR";
  eligibleWeekdays: readonly Weekday[]; excludedDates?: readonly string[];
  effectiveFrom?: string | null; effectiveTo?: string | null }>;
/** Configurable household product policy, not a universal legal assertion. */
export const HOUSEHOLD_BENEFIT_USAGE_POLICY: BenefitWalletUsagePolicy = Object.freeze({
  dailyCap: "25.00", currency: "EUR", eligibleWeekdays: Object.freeze([1, 2, 3, 4, 5, 6] as const),
});
export function walletDateEligible(date: string, policy: BenefitWalletUsagePolicy): boolean {
  return policy.eligibleWeekdays.includes(new Date(`${date}T12:00:00Z`).getUTCDay() as Weekday)
    && !policy.excludedDates?.includes(date) && (!policy.effectiveFrom || date >= policy.effectiveFrom)
    && (!policy.effectiveTo || date <= policy.effectiveTo);
}
