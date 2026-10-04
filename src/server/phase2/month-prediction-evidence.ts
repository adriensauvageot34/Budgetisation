import "server-only";
import Big from "big.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCanonicalHouseholdScope, resolvePurchaseEventTiming } from "@/analytics/facts";
import type { PurchaseEventTimingAssertion } from "@/analytics/facts/purchase-event";
import { sourceCoverage, continuousCoverage, addCalendarDays, DEFAULT_BANK_GRACE_DAYS, FORECAST_SOURCES, type EvidenceSource } from "./forecast-opportunities";
import { planningDate } from "./planning-date";
import type { EconomicReferenceEntry, MobilityReferenceLeg } from "./month-reference";
import type { MonthPredictionEvidence } from "./remaining-month-forecast";
import { BENEFIT_PROVIDERS, type BenefitProvider } from "@/domain/phase2/benefit-wallets";
import type { CanonicalBenefitWallet, BenefitLedgerEntry } from "./benefit-wallet-funding";
import { monthInputsSchema } from "./month-scenario";

/** Purchase identity replaces its bank components; funding never adds a second cost. */
export function mergePredictionPurchases(bank: readonly EconomicReferenceEntry[], purchases: readonly {
  entry: EconomicReferenceEntry; representedOperationIds: readonly string[];
}[]): EconomicReferenceEntry[] {
  const represented = new Set(purchases.flatMap(p => p.representedOperationIds));
  const identities = new Set<string>();
  return [...bank.filter(row => !represented.has(row.operationId)), ...purchases.map(p => p.entry)].filter(row => {
    const identity = row.purchaseEventId ? `purchase:${row.purchaseEventId}` : row.canonicalComponentKey ?? `operation:${row.operationId}`;
    if (identities.has(identity)) return false;
    identities.add(identity); return true;
  });
}

/** Read-only adapter. The singleton control authorizes legacy relations without household_id.
 * Modern relations are additionally scoped. No writes, fallbacks or partial page reads. */
export async function readMonthPredictionEvidence(client: SupabaseClient, householdId: string, targetMonth: string,
  allowEmptyHistory = false, options: { asOfDate?: string; timezone?: string } = {}): Promise<MonthPredictionEvidence> {
  const scope = await client.from("canonical_household_scope_control").select("household_count,household_id,status").limit(2);
  if (scope.error) throw scope.error;
  if (scope.data?.length !== 1 || parseCanonicalHouseholdScope(scope.data[0]) !== householdId)
    throw new TypeError("MONTH_PREDICTION_CANONICAL_SCOPE_INVALID");
  const household = await client.from("households").select("timezone").eq("household_id", householdId).maybeSingle();
  if (household.error) throw household.error;
  const timezone = options.timezone ?? household.data?.timezone ?? "Europe/Paris";
  const asOf = options.asOfDate ?? planningDate(timezone);
  const boundary = targetMonth < asOf.slice(0, 7) ? targetMonth : asOf.slice(0, 7);
  const latest = await client.from("operations").select("date_bancaire").lt("date_bancaire", `${boundary}-01`)
    .order("date_bancaire", { ascending: false }).limit(1).maybeSingle();
  if (latest.error) throw latest.error;
  const previous = new Date(`${boundary}-01T12:00:00Z`); previous.setUTCMonth(previous.getUTCMonth() - 1);
  const endMonth = latest.data?.date_bancaire?.slice(0, 7) ?? (allowEmptyHistory ? previous.toISOString().slice(0, 7) : null);
  if (!endMonth) throw new TypeError("MONTH_PREDICTION_HISTORY_MISSING");
  const first = new Date(`${endMonth}-01T12:00:00Z`); first.setUTCMonth(first.getUTCMonth() - 11);
  const startDate = first.toISOString().slice(0, 10);
  const end = new Date(`${targetMonth}-01T12:00:00Z`); end.setUTCMonth(end.getUTCMonth() + 1);
  const endExclusive = end.toISOString().slice(0, 10);
  async function page<T>(read: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 1000) {
      const result = await read(offset); if (result.error) throw result.error;
      rows.push(...(result.data ?? [])); if ((result.data?.length ?? 0) < 1000) return rows;
    }
  }
  const [subcategories, needs, people, batches, wallets, datasets, balanceRows] = await Promise.all([
    client.from("subcategories").select("subcategory_id,nom_canonique"),
    client.from("needs").select("need_id,name,personne_concernee"),
    client.from("persons").select("person_id,display_name").eq("household_id", householdId),
    client.from("import_batches").select("import_batch_id,source_instance_key,source_system,period_start,period_end,coverage_status,status").eq("household_id", householdId),
    client.from("benefit_wallets").select("benefit_wallet_id,provider,owner_person_id,currency,status,source_instance_key,import_batch_id,coverage_start,coverage_end,opening_balance,opening_balance_status,closing_balance,closing_balance_status").eq("household_id", householdId),
    client.from("mobility_datasets").select("period_start,period_end").eq("household_id", householdId),
    page(offset => client.from("phase2_month_inputs").select("payload,target_month").eq("household_id", householdId)
      .order("target_month", { ascending: false }).range(offset, offset + 999)),
  ]);
  for (const result of [subcategories, needs, people, batches, wallets, datasets]) if (result.error) throw result.error;
  // Only the observed stock can cross months. Salaries, wallet resources and assumptions
  // remain owned by their target month's inputs. The cash helper still requires ledger proof.
  const manualBankBalanceObservation = balanceRows.map(row => monthInputsSchema.parse(row.payload).openingBalance)
    .filter((value): value is NonNullable<typeof value> => value !== null && value.asOfDate <= asOf)
    .sort((a, b) => b.asOfDate.localeCompare(a.asOfDate))[0] ?? null;
  const names = new Map((subcategories.data ?? []).map(r => [r.subcategory_id, r.nom_canonique]));
  const needById = new Map((needs.data ?? []).map(r => [r.need_id, r]));
  const personNamesById = Object.fromEntries((people.data ?? []).map(r => [r.person_id, r.display_name]));
  const walletById = new Map((wallets.data ?? []).map(r => [r.benefit_wallet_id, r]));
  const [operations, costs, events, memberships, timings, funding, legs, benefitLedger] = await Promise.all([
    page(offset => client.from("operations").select("operation_id,date_bancaire,personne_concernee,type_precis,marchand,merchant_id,need_id,montant,flux,recurrence_series_id,reference_contrat,transfert_associe_operation_id,source_system")
      .gte("date_bancaire", startDate).lt("date_bancaire", endExclusive).lte("date_bancaire", asOf).order("operation_id").range(offset, offset + 999)),
    page(offset => client.from("financial_economic_cost_canonical").select("operation_id,subcategory_id,canonical_economic_net,canonical_component_key")
      .order("canonical_component_key").range(offset, offset + 999)),
    page(offset => client.from("purchase_events").select("purchase_event_id,gross_amount,gross_amount_status,subcategory_id,need_id,merchant_id,semantic_purpose")
      .eq("household_id", householdId).eq("purchase_visibility", "PURCHASE_AWARE_PILOT").order("purchase_event_id").range(offset, offset + 999)),
    page(offset => client.from("purchase_event_memberships").select("purchase_event_id,operation_id,canonical_component_key,membership_kind")
      .eq("household_id", householdId).order("purchase_event_membership_id").range(offset, offset + 999)),
    page(offset => client.from("purchase_event_timing_assertions").select("purchase_event_id,timing_authority,timing_precision,economic_date,economic_month,evidence_refs")
      .eq("household_id", householdId).eq("is_active", true).order("purchase_event_timing_assertion_id").range(offset, offset + 999)),
    page(offset => client.from("purchase_funding_components").select("purchase_event_id,funding_kind,amount,amount_status,benefit_wallet_id,bank_operation_id")
      .eq("household_id", householdId).order("purchase_funding_component_id").range(offset, offset + 999)),
    page(offset => client.from("mobility_legs").select("travel_date,origin_source_label,destination_source_label,estimated_fuel_cost,mobility_leg_id")
      .eq("household_id", householdId).eq("status", "CERTIFIED_SOURCE").gte("travel_date", startDate).lt("travel_date", endExclusive)
      .lte("travel_date", asOf).order("mobility_leg_id").range(offset, offset + 999)),
    page(offset => client.from("benefit_wallet_ledger_entries").select("benefit_wallet_ledger_entry_id,benefit_wallet_id,event_date,entry_kind,amount,currency,purchase_event_id")
      .eq("household_id", householdId).gte("event_date", startDate).lte("event_date", asOf)
      .order("benefit_wallet_ledger_entry_id").range(offset, offset + 999)),
  ]);
  const operationById = new Map(operations.map(r => [r.operation_id, r]));
  const bank: EconomicReferenceEntry[] = costs.flatMap(cost => {
    const op = operationById.get(cost.operation_id), name = names.get(cost.subcategory_id), need = needById.get(op?.need_id);
    return op && name && Number(cost.canonical_economic_net) >= 0 ? [{ operationId: op.operation_id, date: op.date_bancaire,
      amount: String(cost.canonical_economic_net), subcategory: name, canonicalComponentKey: cost.canonical_component_key,
      person: need?.personne_concernee ?? op.personne_concernee, need: need?.name ?? null, preciseType: op.type_precis,
      merchant: op.marchand, merchantId: op.merchant_id, funding: { BANK: String(cost.canonical_economic_net) }, fundingComplete: true }] : [];
  });
  const limitations = new Set<string>();
  const purchases = events.flatMap(event => {
    const timing = resolvePurchaseEventTiming(timings.filter(t => t.purchase_event_id === event.purchase_event_id).map(t => ({
      authority: t.timing_authority, precision: t.timing_precision, economicDate: t.economic_date,
      economicMonth: t.economic_month, evidenceRefs: t.evidence_refs,
    }) as PurchaseEventTimingAssertion));
    if (timing.status !== "KNOWN" || timing.economicDate === null) { limitations.add("PURCHASE_DAY_UNRESOLVED"); return []; }
    if (timing.economicDate < startDate || timing.economicDate >= endExclusive || timing.economicDate > asOf) return [];
    if (!["KNOWN", "PARTIAL"].includes(event.gross_amount_status) || event.gross_amount === null) {
      limitations.add("PURCHASE_AMOUNT_UNRESOLVED"); return [];
    }
    const links = memberships.filter(m => m.purchase_event_id === event.purchase_event_id);
    const funds = funding.filter(f => f.purchase_event_id === event.purchase_event_id);
    const ids = [...new Set([...links.flatMap(m => m.operation_id ? [m.operation_id] : []), ...funds.flatMap(f => f.bank_operation_id ? [f.bank_operation_id] : [])])];
    const op = ids.map(id => operationById.get(id)).find(Boolean), need = needById.get(event.need_id ?? op?.need_id);
    const distribution: Partial<Record<"BANK" | "SWILE" | "EDENRED", string>> = {};
    let fundingComplete = funds.length > 0;
    for (const fund of funds) {
      const source = fund.funding_kind === "BANK_CARD" ? "BANK" : walletById.get(fund.benefit_wallet_id)?.provider;
      if (!["BANK", "SWILE", "EDENRED"].includes(source) || fund.amount_status !== "KNOWN") { fundingComplete = false; continue; }
      const key = source as keyof typeof distribution;
      distribution[key] = new Big(distribution[key] ?? 0).plus(fund.amount).toFixed(2);
    }
    fundingComplete = fundingComplete && event.gross_amount_status === "KNOWN" && Object.values(distribution).reduce((n, amount) => n.plus(amount!), new Big(0)).eq(event.gross_amount);
    if (event.gross_amount_status === "PARTIAL") limitations.add("PURCHASE_AMOUNT_LOWER_BOUND");
    return [{ representedOperationIds: ids, entry: { operationId: op?.operation_id ?? `purchase:${event.purchase_event_id}`,
      purchaseEventId: event.purchase_event_id, date: timing.economicDate, amount: String(event.gross_amount),
      amountStatus: event.gross_amount_status as "KNOWN" | "PARTIAL", subcategory: names.get(event.subcategory_id) ?? "",
      person: need?.personne_concernee ?? op?.personne_concernee ?? null, need: need?.name ?? null,
      preciseType: event.semantic_purpose === "WORK_LUNCH" ? "Repas du midi au travail" : op?.type_precis ?? null,
      merchant: op?.marchand ?? null, merchantId: event.merchant_id ?? op?.merchant_id ?? null,
      funding: distribution, fundingComplete,
      bankPaymentObserved: fundingComplete && funds.filter(f => f.funding_kind === "BANK_CARD").every(f => f.amount_status === "KNOWN" && operationById.has(f.bank_operation_id)) } satisfies EconomicReferenceEntry }];
  });
  const rows = mergePredictionPurchases(bank, purchases);
  const mobility: MobilityReferenceLeg[] = legs.filter(l => l.estimated_fuel_cost !== null).map(l => ({ id: l.mobility_leg_id,
    date: l.travel_date, origin: l.origin_source_label, destination: l.destination_source_label, fuelCost: String(l.estimated_fuel_cost) }));
  const imported = (batches.data ?? []).filter(b => b.status === "imported");
  const coverageBySource = Object.fromEntries(FORECAST_SOURCES.map(source => {
    const sourceBatches = imported.filter(b => b.source_system === source);
    const full = sourceBatches.filter(b => b.coverage_status === "FULL" && b.period_start && b.period_end);
    const sourceRows = rows.filter(r => r.funding?.[source as "BANK" | "SWILE" | "EDENRED"] !== undefined);
    const latestObserved = (source === "MOBILITY" ? mobility.map(l => l.date) : source === "BANK" ? operations.map(o => o.date_bancaire) : sourceRows.map(r => r.date)).sort().at(-1) ?? null;
    const status = full.length ? "FULL" : sourceBatches.some(b => b.coverage_status === "PARTIAL") ? "PARTIAL"
      : sourceBatches.length || (source === "MOBILITY" && datasets.data?.length) ? "UNKNOWN" : "ABSENT";
    const intervals = (status === "FULL" ? full : sourceBatches).filter(b => b.period_start && b.period_end).map(b => ({ start: b.period_start, end: b.period_end }));
    return [source, sourceCoverage(source, `${targetMonth}-01`, asOf, intervals, status, latestObserved)];
  })) as Record<EvidenceSource, ReturnType<typeof sourceCoverage>>;
  const completeMonthsBySource = Object.fromEntries(FORECAST_SOURCES.map(source => {
    const intervals = imported.filter(b => b.source_system === source && b.coverage_status === "FULL" && b.period_start && b.period_end)
      .map(b => ({ start: b.period_start, end: b.period_end }));
    const months: string[] = [];
    for (const cursor = new Date(first); cursor < end; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
      const month = cursor.toISOString().slice(0, 7), last = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
      const proofThrough = source === "BANK" ? addCalendarDays(last, DEFAULT_BANK_GRACE_DAYS) : last;
      if (last < asOf && proofThrough <= asOf && (continuousCoverage(intervals, `${month}-01`) ?? "") >= proofThrough) months.push(month);
    }
    return [source, months];
  })) as Record<EvidenceSource, string[]>;
  const canonicalWallets: CanonicalBenefitWallet[] = (wallets.data ?? []).filter(wallet => BENEFIT_PROVIDERS.includes(wallet.provider as BenefitProvider)).map(wallet => ({
    id: wallet.benefit_wallet_id, provider: wallet.provider as BenefitProvider, ownerPersonId: wallet.owner_person_id ?? null,
    currency: wallet.currency ?? "UNKNOWN", status: wallet.status ?? "UNKNOWN", coverageStart: wallet.coverage_start ?? null, coverageEnd: wallet.coverage_end ?? null,
    openingBalance: wallet.opening_balance_status === "KNOWN" && wallet.opening_balance != null ? String(wallet.opening_balance) : null,
    closingBalance: wallet.closing_balance_status === "KNOWN" && wallet.closing_balance != null ? String(wallet.closing_balance) : null,
    coverageIntervals: imported.filter(batch => batch.source_system === wallet.provider && batch.coverage_status === "FULL" && batch.period_start && batch.period_end
      && (batch.import_batch_id === wallet.import_batch_id && wallet.import_batch_id != null
        || batch.source_instance_key === wallet.source_instance_key && wallet.source_instance_key != null && batch.source_system === wallet.provider))
      .map(batch => ({ start: batch.period_start < startDate ? startDate : batch.period_start, end: batch.period_end < asOf ? batch.period_end : asOf }))
      .filter(interval => interval.start <= interval.end),
  }));
  const ledger: BenefitLedgerEntry[] = benefitLedger.filter(row => row.currency === "EUR" && canonicalWallets.some(wallet => wallet.id === row.benefit_wallet_id))
    .map(row => ({ id: row.benefit_wallet_ledger_entry_id, walletId: row.benefit_wallet_id, date: row.event_date,
      amount: String(row.amount), kind: row.entry_kind as "CREDIT" | "PURCHASE_DEBIT", purchaseEventId: row.purchase_event_id }));
  const openingObservations = Object.fromEntries(BENEFIT_PROVIDERS.map(provider => [provider,
    balanceRows.flatMap(row => monthInputsSchema.parse(row.payload).benefitWallets?.[provider].balanceObservations ?? [])
      .filter(row => row.asOfDate < `${targetMonth}-01` && row.asOfDate <= asOf)
      .sort((a, b) => b.asOfDate.localeCompare(a.asOfDate) || a.id.localeCompare(b.id))
      .filter((row, index, all) => all.findIndex(other => other.asOfDate === row.asOfDate) === index),
  ]));
  const latestObservedBookingDate = operations.map(o => o.date_bancaire).sort().at(-1) ?? null;
  return { benefitWalletEvidence: { wallets: canonicalWallets, ledger, openingObservations }, timezone, asOfDate: asOf, manualBankBalanceObservation, history: { startMonth: startDate.slice(0, 7), endMonth,
    economicEntries: rows.filter(r => r.date.slice(0, 7) <= endMonth), mobilityLegs: mobility.filter(l => l.date.slice(0, 7) <= endMonth) },
    currentEconomicEntries: rows.filter(r => r.date.startsWith(targetMonth)), currentMobilityLegs: mobility.filter(l => l.date.startsWith(targetMonth)),
    bankObservations: operations.map(o => ({ id: o.operation_id, date: o.date_bancaire, amount: String(o.montant),
      direction: o.flux === "Revenu" ? "IN" as const : o.flux === "Dépense" ? "OUT" as const : "TRANSFER" as const,
      merchant: o.marchand, merchantId: o.merchant_id, recurrenceSeriesId: o.recurrence_series_id,
      contractRef: o.reference_contrat, transferPeerId: o.transfert_associe_operation_id })),
    observedThrough: latestObservedBookingDate, latestObservedBookingDate, coverageBySource, completeMonthsBySource,
    bankCoverageIntervals: imported.filter(b => b.source_system === "BANK" && b.coverage_status === "FULL" && b.period_start && b.period_end)
      .map(b => ({ start: b.period_start < startDate ? startDate : b.period_start,
        end: [b.period_end, asOf, new Date(Date.parse(`${endExclusive}T12:00:00Z`) - 86400000).toISOString().slice(0, 10)].sort()[0]! }))
      .filter(interval => interval.start <= interval.end),
    coverageThrough: coverageBySource.BANK.coverageThrough, completeMonths: completeMonthsBySource.BANK,
    limitationCodes: [...limitations].sort(), personNamesById };
}
