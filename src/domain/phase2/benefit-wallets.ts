export const BENEFIT_PROVIDERS = ["SWILE", "EDENRED"] as const;
export type BenefitProvider = typeof BENEFIT_PROVIDERS[number];
export type WalletBalanceObservation = Readonly<{ id: string; amount: string; asOfDate: string;
  provenance: "USER_DECLARED"; isOpeningObservation?: boolean }>;
export type WalletExpectedLoading = Readonly<{ amount: string; expectedDate: string | null }>;
export type MonthlyBenefitWalletInput = Readonly<{ provider: BenefitProvider;
  balanceObservations: readonly WalletBalanceObservation[]; expectedLoading: WalletExpectedLoading | null }>;
export type MonthlyBenefitWalletInputs = Readonly<Record<BenefitProvider, MonthlyBenefitWalletInput>>;
export const benefitResourceKey = (provider: BenefitProvider): "benefit:swile" | "benefit:edenred" =>
  provider === "SWILE" ? "benefit:swile" : "benefit:edenred";
export function parseBenefitProvider(value: unknown): BenefitProvider {
  if (value !== "SWILE" && value !== "EDENRED") throw new TypeError("BENEFIT_PROVIDER_INVALID");
  return value;
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("BENEFIT_WALLET_INPUT_INVALID");
  return value as Record<string, unknown>;
};
export function parseWalletAmount(value: unknown): string {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/u.test(value)) throw new TypeError("BENEFIT_AMOUNT_INVALID");
  return value;
}
export function parseWalletDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)
    || Number.isNaN(Date.parse(`${value}T12:00:00Z`)) || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value)
    throw new TypeError("BENEFIT_DATE_INVALID");
  return value;
}
/** New wallet JSON is authoritative. Legacy values are mapped to Swile only. */
export function parseMonthlyBenefitWallets(raw: unknown, legacy: { currentBalance: { amount: string; asOfDate: string } | null;
  expectedLoading: WalletExpectedLoading | null }, declared: Partial<Record<"benefit:swile" | "benefit:edenred", string>>): MonthlyBenefitWalletInputs {
  const wallets = raw === undefined ? null : object(raw);
  if (wallets && Object.keys(wallets).some(key => !BENEFIT_PROVIDERS.includes(key as BenefitProvider))) throw new TypeError("BENEFIT_PROVIDER_INVALID");
  const parseWallet = (provider: BenefitProvider): MonthlyBenefitWalletInput => {
    const entry = wallets ? object(wallets[provider]) : {
      provider, balanceObservations: provider === "SWILE" && legacy.currentBalance ? [{ ...legacy.currentBalance,
        id: "00000000-0000-4000-8000-000000000002", provenance: "USER_DECLARED", isOpeningObservation: true }] : [],
      expectedLoading: provider === "SWILE" && legacy.expectedLoading ? legacy.expectedLoading :
        declared[benefitResourceKey(provider)] !== undefined ? { amount: declared[benefitResourceKey(provider)], expectedDate: null } : null,
    };
    if (entry.provider !== provider || !Array.isArray(entry.balanceObservations) || entry.balanceObservations.length > 60)
      throw new TypeError("BENEFIT_WALLET_INPUT_INVALID");
    const observations = entry.balanceObservations.map(raw => {
      const row = object(raw);
      if (typeof row.id !== "string" || !/^[0-9a-f-]{36}$/iu.test(row.id) || row.provenance !== "USER_DECLARED"
        || (row.isOpeningObservation !== undefined && typeof row.isOpeningObservation !== "boolean")) throw new TypeError("BENEFIT_OBSERVATION_INVALID");
      return { id: row.id, amount: parseWalletAmount(row.amount), asOfDate: parseWalletDate(row.asOfDate), provenance: "USER_DECLARED" as const,
        ...(row.isOpeningObservation === true ? { isOpeningObservation: true } : {}) };
    }).sort((a, b) => a.asOfDate.localeCompare(b.asOfDate) || a.id.localeCompare(b.id));
    if (new Set(observations.map(row => row.asOfDate)).size !== observations.length || new Set(observations.map(row => row.id)).size !== observations.length)
      throw new TypeError("BENEFIT_OBSERVATION_DUPLICATE");
    const loading = entry.expectedLoading === null ? null : object(entry.expectedLoading);
    return { provider, balanceObservations: observations, expectedLoading: loading === null ? null : {
      amount: parseWalletAmount(loading.amount), expectedDate: loading.expectedDate === null ? null : parseWalletDate(loading.expectedDate),
    } };
  };
  return { SWILE: parseWallet("SWILE"), EDENRED: parseWallet("EDENRED") };
}
export function validateWalletMonth(wallets: MonthlyBenefitWalletInputs, month: string): void {
  for (const wallet of Object.values(wallets)) {
    if (wallet.balanceObservations.some(row => !row.asOfDate.startsWith(month)
      && !(row.isOpeningObservation && row.asOfDate < `${month}-01`))) throw new TypeError("BENEFIT_OBSERVATION_MONTH_INVALID");
    if (wallet.expectedLoading?.expectedDate && !wallet.expectedLoading.expectedDate.startsWith(month)) throw new TypeError("BENEFIT_LOADING_MONTH_INVALID");
  }
}
