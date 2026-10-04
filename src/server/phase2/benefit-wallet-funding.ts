import "server-only";
import Big from "big.js";
import { BENEFIT_PROVIDERS, benefitResourceKey, type BenefitProvider, type MonthlyBenefitWalletInputs,
  type WalletBalanceObservation, type WalletExpectedLoading } from "@/domain/phase2/benefit-wallets";
import { HOUSEHOLD_BENEFIT_USAGE_POLICY, walletDateEligible, type BenefitWalletUsagePolicy } from "@/domain/phase2/benefit-wallet-policy";
import { continuousCoverage, addCalendarDays, type CoverageInterval, type AsOfContext } from "./forecast-opportunities";
import { costItemCashTreatment } from "@/domain/phase2/planned-money";
import type { PlannedExpenseScenarioEntry } from "./planned-expenses";
import type { RemainingCategory, FundingRange, CostRange } from "./remaining-month-forecast";

export type CanonicalBenefitWallet = Readonly<{ id: string; provider: BenefitProvider; ownerPersonId: string | null;
  currency: string; status: string; coverageStart: string | null; coverageEnd: string | null;
  openingBalance: string | null; closingBalance: string | null;
  coverageIntervals: readonly CoverageInterval[] }>;
export type BenefitLedgerEntry = Readonly<{ id: string; walletId: string; date: string; amount: string;
  kind: "CREDIT" | "PURCHASE_DEBIT"; purchaseEventId?: string | null }>;
export type BenefitWalletEvidence = Readonly<{ wallets: readonly CanonicalBenefitWallet[];
  ledger: readonly BenefitLedgerEntry[]; openingObservations?: Partial<Record<BenefitProvider, readonly WalletBalanceObservation[]>> }>;
export type WalletBalanceKnowledge = Readonly<{ status: "KNOWN_AT_ASOF" | "RECONSTRUCTED" | "OBSERVED_STALE" | "UNKNOWN";
  amount: string | null; asOfDate: string; latestObservation: WalletBalanceObservation | null;
  provenance: readonly string[]; limitations: readonly string[] }>;
const money = (amount: Big | string | number) => new Big(amount).round(2).toFixed(2);
const positive = (amount: Big) => amount.gt(0) ? amount : new Big(0);
const min = (...amounts: Big[]) => amounts.reduce((a, b) => a.lt(b) ? a : b);
const zeroRange = (): CostRange => ({ low: "0.00", central: "0.00", high: "0.00" });

/** Pure stock resolver. A credit is never inferred from balance differences. */
export function resolveBenefitWalletBalance(input: { asOf: string; observations: readonly WalletBalanceObservation[];
  wallet?: CanonicalBenefitWallet | null; ledger?: readonly BenefitLedgerEntry[] }): WalletBalanceKnowledge {
  const latest = [...input.observations].filter(row => row.asOfDate <= input.asOf)
    .sort((a, b) => b.asOfDate.localeCompare(a.asOfDate) || a.id.localeCompare(b.id))[0] ?? null;
  const result = (status: WalletBalanceKnowledge["status"], amount: string | null, provenance: string[], limitations: string[] = []): WalletBalanceKnowledge =>
    ({ status, amount, asOfDate: input.asOf, latestObservation: latest, provenance, limitations });
  if (latest?.asOfDate === input.asOf) return result("KNOWN_AT_ASOF", money(latest.amount), ["USER_DECLARED", latest.id]);
  const wallet = input.wallet;
  const reconstruct = (amount: string, date: string, opening = false): string | null => {
    const start = opening ? date : addCalendarDays(date, 1);
    if (!wallet || wallet.currency !== "EUR" || wallet.status === "INACTIVE" || start > input.asOf
      || (continuousCoverage(wallet.coverageIntervals, start) ?? "") < input.asOf) return null;
    const ledger = [...new Map((input.ledger ?? []).filter(row => row.walletId === wallet.id && row.date >= start && row.date <= input.asOf).map(row => [row.id, row])).values()];
    const value = ledger.reduce((sum, row) => row.kind === "CREDIT" ? sum.plus(row.amount) : sum.minus(row.amount), new Big(amount));
    return value.lt(0) ? null : money(value);
  };
  if (latest) {
    const amount = reconstruct(latest.amount, latest.asOfDate);
    if (amount !== null) return result("RECONSTRUCTED", amount, ["USER_DECLARED", latest.id, "CONTINUOUS_CANONICAL_BENEFIT_LEDGER"]);
  }
  if (wallet?.currency === "EUR" && wallet.status !== "INACTIVE") {
    if (wallet.closingBalance !== null && wallet.coverageEnd === input.asOf && (!latest || wallet.coverageEnd >= latest.asOfDate))
      return result("KNOWN_AT_ASOF", money(wallet.closingBalance), ["CANONICAL_CLOSING_BALANCE", wallet.id]);
    for (const anchor of [{ amount: wallet.closingBalance, date: wallet.coverageEnd, opening: false },
      { amount: wallet.openingBalance, date: wallet.coverageStart, opening: true }]) {
      if (anchor.amount === null || anchor.date === null || anchor.date > input.asOf || (latest && anchor.date < latest.asOfDate)) continue;
      const amount = reconstruct(anchor.amount, anchor.date, anchor.opening);
      if (amount !== null) return result("RECONSTRUCTED", amount, ["CANONICAL_BALANCE", wallet.id, "CONTINUOUS_CANONICAL_BENEFIT_LEDGER"]);
    }
  }
  return result(latest ? "OBSERVED_STALE" : "UNKNOWN", null, latest ? ["USER_DECLARED", latest.id] : [],
    [latest ? "BENEFIT_LEDGER_CONTINUITY_UNKNOWN" : "BENEFIT_BALANCE_UNOBSERVED"]);
}

export type WalletPlannedUse = Readonly<{ date: string | null; amount: string }>;
export type WalletSpendCapacity = Readonly<{ eligibleDaysRemaining: number; calendarCapacity: string;
  usableStock: string | null; futureKnownLoading: string; usableCapacity: string | null;
  plannedReserved: string; plannedSupported: string | null; shortfall: string; fundingToComplete: string;
  availableCapacity: string | null; dayCapacity: Readonly<Record<string, string>>; fundsAvailableByDate: Readonly<Record<string, string>>; limitations: readonly string[] }>;

/** One shared cap per wallet/date; expected future credits enter only on their dates.
 * Supported plans have priority over forecast use. No persisted funding is rewritten. */
export function projectWalletSpendCapacity(input: { asOf: string; start: string; end: string; balance: WalletBalanceKnowledge;
  loading: WalletExpectedLoading | null; policy: BenefitWalletUsagePolicy; planned: readonly WalletPlannedUse[];
  observedDebits?: readonly { date: string; amount: string }[] }): WalletSpendCapacity {
  const limitations = new Set(input.balance.limitations);
  const days: string[] = [];
  for (let date = input.start > input.asOf ? input.start : input.asOf; date <= input.end; date = addCalendarDays(date, 1)) days.push(date);
  const cap = new Big(input.policy.dailyCap);
  const eligible = days.filter(date => walletDateEligible(date, input.policy));
  const dayLimits = Object.fromEntries(days.map(date => [date, walletDateEligible(date, input.policy) ? positive(cap.minus(
    (input.observedDebits ?? []).filter(row => row.date === date).reduce((sum, row) => sum.plus(row.amount), new Big(0)))) : new Big(0)]));
  const future = input.loading?.expectedDate && input.loading.expectedDate > input.asOf
    && input.loading.expectedDate <= input.end ? input.loading : null;
  if (input.loading?.expectedDate === null) limitations.add("BENEFIT_LOADING_DATE_UNKNOWN");
  if (input.loading?.expectedDate && input.loading.expectedDate <= input.asOf) limitations.add("PAST_LOADING_NOT_ADDED_TO_CURRENT_STOCK");
  const requested = input.planned.reduce((sum, use) => sum.plus(use.amount), new Big(0));
  const byDate = new Map<string, Big>();
  let unresolved = new Big(0), hardShortfall = new Big(0);
  for (const use of input.planned) {
    if (use.date && !walletDateEligible(use.date, input.policy)) { hardShortfall = hardShortfall.plus(use.amount); limitations.add("PLANNED_WALLET_DATE_INELIGIBLE"); }
    else if (!use.date || use.date < (days[0] ?? input.asOf) || use.date > input.end) {
      unresolved = unresolved.plus(use.amount); limitations.add("PLANNED_WALLET_DATE_UNRESOLVED");
    } else byDate.set(use.date, (byDate.get(use.date) ?? new Big(0)).plus(use.amount));
  }
  if (input.balance.amount === null) {
    for (const [date, amount] of byDate) hardShortfall = hardShortfall.plus(positive(amount.minus(dayLimits[date]!)));
    return { eligibleDaysRemaining: eligible.length, calendarCapacity: money(cap.times(eligible.length)),
      usableStock: null, futureKnownLoading: money(future?.amount ?? 0), usableCapacity: null, plannedReserved: money(requested),
      plannedSupported: null, shortfall: money(hardShortfall), fundingToComplete: money(requested), availableCapacity: null,
      dayCapacity: {}, fundsAvailableByDate: {}, limitations: [...limitations].sort() };
  }
  const earlyLoading = future?.expectedDate && future.expectedDate < (days[0] ?? input.start) ? new Big(future.amount) : new Big(0);
  let stock = new Big(input.balance.amount).plus(earlyLoading), maximum = new Big(0), supported = new Big(0), actualStock = stock;
  const supportedByDay: Record<string, Big> = {};
  for (const date of days) {
    if (future?.expectedDate === date) { stock = stock.plus(future.amount); actualStock = actualStock.plus(future.amount); }
    const available = min(stock, dayLimits[date]!); maximum = maximum.plus(available); stock = stock.minus(available);
    const request = byDate.get(date) ?? new Big(0), support = min(actualStock, dayLimits[date]!, request);
    supportedByDay[date] = support; supported = supported.plus(support); actualStock = actualStock.minus(support);
    hardShortfall = hardShortfall.plus(request.minus(support));
  }
  // Undated/past intent is retained and reserved conservatively, with unresolved feasibility.
  let futureReserved = supported, fundingStock = new Big(input.balance.amount).plus(earlyLoading), remainder = new Big(0);
  const dayCapacity: Record<string, string> = {}, fundsAvailableByDate: Record<string, string> = {};
  let hypotheticalSpend = new Big(0);
  for (const date of days) {
    if (future?.expectedDate === date) fundingStock = fundingStock.plus(future.amount);
    const committed = supportedByDay[date]!; futureReserved = futureReserved.minus(committed); fundingStock = positive(fundingStock.minus(committed));
    const unreservedFunds = positive(fundingStock.minus(futureReserved).minus(unresolved));
    const free = min(unreservedFunds, positive(dayLimits[date]!.minus(committed)));
    dayCapacity[date] = money(positive(dayLimits[date]!.minus(committed)));
    fundsAvailableByDate[date] = money(unreservedFunds);
    const spend = min(free, positive(unreservedFunds.minus(hypotheticalSpend)));
    remainder = remainder.plus(spend); hypotheticalSpend = hypotheticalSpend.plus(spend);
  }
  if (hardShortfall.gt(0)) limitations.add("PLANNED_WALLET_CAPACITY_SHORTFALL");
  return { eligibleDaysRemaining: eligible.length, calendarCapacity: money(cap.times(eligible.length)), usableStock: money(input.balance.amount),
    futureKnownLoading: money(future?.amount ?? 0), usableCapacity: money(maximum), plannedReserved: money(requested),
    plannedSupported: money(supported), shortfall: money(hardShortfall), fundingToComplete: money(hardShortfall.plus(unresolved)),
    availableCapacity: money(remainder), dayCapacity, fundsAvailableByDate, limitations: [...limitations].sort() };
}

export type BenefitWalletProjection = WalletSpendCapacity & Readonly<{ provider: BenefitProvider; ownerPersonId: string | null;
  latestObservation: WalletBalanceObservation | null; currentBalanceKnowledge: WalletBalanceKnowledge;
  expectedLoading: WalletExpectedLoading | null; policy: BenefitWalletUsagePolicy;
  forecastExpectedUse: CostRange; remainingCapacityAfterForecast: FundingRange }>;
export type BenefitWalletProjections = Readonly<Record<BenefitProvider, BenefitWalletProjection>>;

/** Sole dated wallet funding owner. Economics and allocations are read-only inputs. */
export function projectMonthlyBenefitWallets(input: { wallets: MonthlyBenefitWalletInputs;
  resourceOverrides: Readonly<Record<string, string>>; evidence?: BenefitWalletEvidence; context: AsOfContext;
  personNamesById: Readonly<Record<string, string>>; expenses: readonly PlannedExpenseScenarioEntry[];
  categories: readonly RemainingCategory[]; policy?: BenefitWalletUsagePolicy }) {
  const policy = input.policy ?? HOUSEHOLD_BENEFIT_USAGE_POLICY;
  const walletModels = {} as Record<BenefitProvider, BenefitWalletProjection>;
  for (const provider of BENEFIT_PROVIDERS) {
    const candidates = (input.evidence?.wallets ?? []).filter(wallet => wallet.provider === provider && wallet.currency === "EUR" && wallet.status !== "INACTIVE");
    const canonical = candidates.length === 1 ? candidates[0]! : null;
    const supplied = input.wallets[provider], inherited = input.evidence?.openingObservations?.[provider] ?? [];
    const observations = [...inherited.filter(row => !supplied.balanceObservations.some(local => local.asOfDate === row.asOfDate)), ...supplied.balanceObservations];
    const balance = resolveBenefitWalletBalance({ asOf: input.context.today, observations, wallet: canonical, ledger: input.evidence?.ledger });
    const loading = supplied.expectedLoading ? { ...supplied.expectedLoading, amount: input.resourceOverrides[benefitResourceKey(provider)] ?? supplied.expectedLoading.amount } : null;
    const planned = input.expenses.flatMap(expense => expense.costItems.filter(item => costItemCashTreatment(item) !== "ECONOMIC_ONLY")
      .flatMap(item => (item.fundingAllocations ?? []).filter(allocation => allocation.source === provider)
        .map(allocation => ({ date: expense.plannedDate ?? null, amount: allocation.amount }))));
    const capacity = projectWalletSpendCapacity({ asOf: input.context.today, start: input.context.monthStart, end: input.context.monthEnd,
      balance, loading, policy, planned, observedDebits: canonical ? input.evidence?.ledger.filter(row => row.walletId === canonical.id && row.kind === "PURCHASE_DEBIT") : [] });
    walletModels[provider] = { ...capacity, provider, ownerPersonId: canonical?.ownerPersonId ?? null,
      latestObservation: balance.latestObservation, currentBalanceKnowledge: balance, expectedLoading: loading, policy,
      forecastExpectedUse: zeroRange(), remainingCapacityAfterForecast: { low: capacity.availableCapacity, central: capacity.availableCapacity, high: capacity.availableCapacity },
      limitations: [...new Set([...capacity.limitations, ...(candidates.length > 1 ? ["MULTIPLE_PROVIDER_WALLETS_UNRESOLVED"] : []),
        ...(!canonical?.ownerPersonId ? ["BENEFIT_OWNER_UNKNOWN"] : [])])].sort() };
  }
  const usage = Object.fromEntries(BENEFIT_PROVIDERS.map(provider => [provider, zeroRange()])) as Record<BenefitProvider, CostRange>;
  const budgets = Object.fromEntries((["low", "central", "high"] as const).map(key => [key,
    Object.fromEntries(BENEFIT_PROVIDERS.map(provider => [provider, { ...walletModels[provider].dayCapacity }]))])) as Record<keyof CostRange, Record<BenefitProvider, Record<string, string>>>;
  const categories = input.categories.map(category => {
    const person = category.key === "adrien-work-meals" ? "Adrien" : category.key === "manon-work-meals" ? "Manon" : null;
    if (person === null) return category; // No new automatic eligibility for groceries/cafés/restaurants.
    const providers = BENEFIT_PROVIDERS.filter(provider => {
      const owner = walletModels[provider].ownerPersonId;
      return owner !== null && input.personNamesById[owner] === person;
    });
    const expectedFunding: Record<"BANK" | "SWILE" | "EDENRED" | "UNKNOWN", FundingRange> = { BANK: zeroRange(), SWILE: zeroRange(), EDENRED: zeroRange(), UNKNOWN: zeroRange() };
    for (const key of ["low", "central", "high"] as const) {
      const cost = new Big(category.remainingForecastEconomic[key]); let allocated = new Big(0);
      const opportunities = category.opportunities.filter(opportunity => opportunity.date !== null && opportunity.date >= input.context.today
        && ["FUTURE", "PENDING_OBSERVATION", "UNRESOLVED"].includes(opportunity.state)).sort((a, b) => a.date!.localeCompare(b.date!) || a.id.localeCompare(b.id));
      for (const opportunity of opportunities) {
        let request = min(positive(cost.minus(allocated)), new Big(opportunity.expectedEconomic[key]));
        for (const provider of providers) {
          if (walletModels[provider].currentBalanceKnowledge.amount === null) continue;
          const available = min(new Big(budgets[key][provider][opportunity.date!] ?? 0),
            positive(new Big(walletModels[provider].fundsAvailableByDate[opportunity.date!] ?? 0).minus(usage[provider][key])));
          const support = min(request, available);
          expectedFunding[provider] = { ...expectedFunding[provider], [key]: money(new Big(expectedFunding[provider][key]!).plus(support)) };
          usage[provider] = { ...usage[provider], [key]: money(new Big(usage[provider][key]).plus(support)) };
          budgets[key][provider][opportunity.date!] = money(available.minus(support)); request = request.minus(support); allocated = allocated.plus(support);
        }
      }
      const unresolved = providers.length === 0 || providers.some(provider => walletModels[provider].currentBalanceKnowledge.amount === null)
        || opportunities.length === 0 && cost.gt(0);
      const other = positive(cost.minus(allocated));
      // SAFE may retain economic expectations for past/unresolved days. The future
      // calendar cannot prove how those meals were paid; keep that part unknown.
      const datedCost = min(cost, opportunities.reduce((sum, opportunity) => sum.plus(opportunity.expectedEconomic[key]), new Big(0)));
      const unknown = unresolved ? other : positive(cost.minus(datedCost));
      expectedFunding.BANK = { ...expectedFunding.BANK, [key]: unknown.gt(0) ? null : money(other) };
      expectedFunding.UNKNOWN = { ...expectedFunding.UNKNOWN, [key]: money(unknown) };
    }
    const limitations = category.limitationCodes.filter(code => code !== "EXPECTED_FUNDING_UNKNOWN");
    if (expectedFunding.BANK.central === null) limitations.push("EXPECTED_FUNDING_UNKNOWN", "WORK_MEAL_WALLET_FUNDING_UNRESOLVED");
    return { ...category, expectedFunding, remainingForecastBankCash: expectedFunding.BANK, fundingToComplete: expectedFunding.UNKNOWN,
      limitationCodes: [...new Set(limitations)].sort() };
  });
  for (const provider of BENEFIT_PROVIDERS) walletModels[provider] = { ...walletModels[provider], forecastExpectedUse: usage[provider],
    remainingCapacityAfterForecast: Object.fromEntries((["low", "central", "high"] as const).map(key => [key,
      walletModels[provider].availableCapacity === null ? null : money(positive(new Big(walletModels[provider].availableCapacity).minus(usage[provider][key])))])) as FundingRange };
  return { wallets: walletModels as BenefitWalletProjections, categories };
}
