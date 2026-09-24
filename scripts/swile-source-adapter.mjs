import fs from "node:fs/promises";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);

const required = (value, label) => {
  if (value === null || value === undefined || value === "") throw new Error(`Missing ${label}`);
  return String(value);
};
const money = (value) => (Math.round(Number(value ?? 0) * 100) / 100).toFixed(2);
const merchantName = (value) => required(value, "merchant").normalize("NFKC").replace(/\s+/g, " ").trim();
const date = (value) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return new Date(Date.UTC(1899, 11, 30) + value * 86400000).toISOString().slice(0, 10);
  return required(value, "date").slice(0, 10);
};
const rows = (workbook, name) => {
  if (!Array.isArray(workbook[name])) throw new Error(`Missing worksheet ${name}`);
  return workbook[name];
};

/** Only this adapter knows the Swile workbook layout and its certified A2/A3 mapping. */
export async function adaptSwileWorkbook(sourcePath, masterPath) {
  const bytes = await fs.readFile(sourcePath);
  const sourceSha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  // The supplied workbooks use namespace-prefixed OOXML that ExcelJS cannot
  // decode. The adapter's Python bridge reads only named sheets; no workbook
  // content is written to the repository.
  const bridge = fileURLToPath(new URL("./swile-workbook-rows.py", import.meta.url));
  const { stdout } = await run(process.env.SWILE_PYTHON ?? "python", [bridge, sourcePath, masterPath],
    { maxBuffer: 20 * 1024 * 1024, encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
  const { source, master } = JSON.parse(stdout);
  const sourceRows = rows(source, "Source_records");
  const purchaseRows = rows(source, "Purchase_events");
  const fundingRows = rows(source, "Purchase_funding_components");
  const classificationRows = rows(source, "Supabase_economic_component_classifications");
  const a2 = rows(master, "20_A2_EVENT_MAP");
  const a2Months = rows(master, "21_A2_MONTH_STREAM");
  const a2Ambiguous = rows(master, "22_A2_AMBIGUOUS");
  const a3 = rows(master, "23_A3_EVENT_LEDGER");
  const mixed = rows(master, "24_A3_MIXED_MATCH");
  const a3Deltas = rows(master, "25_A3_DELTA_ORACLE");
  const a3AntiDouble = rows(master, "26_A3_ANTI_DOUBLE");
  const a3Conflicts = rows(master, "27_A3_CONFLICTS");
  const a2ById = new Map(a2.map((row) => [row.purchase_event_id, row]));
  const a3ById = new Map(a3.map((row) => [row.purchase_event_id, row]));
  const mixedById = new Map(mixed.map((row) => [row.purchase_event_id, row]));
  if ([sourceRows.length, purchaseRows.length, fundingRows.length, a2.length, a3.length, mixed.length].join() !== "213,200,255,200,200,54") {
    throw new Error("Raw workbook and A2/A3 cardinalities have changed");
  }
  if (a2Ambiguous.length !== 0 || a3Conflicts.length !== 0) throw new Error("A2/A3 oracle contains blocking ambiguity/conflict");
  const cents = (value) => Math.round(Number(value ?? 0) * 100);
  for (const monthRow of a2Months) {
    const group = a2.filter((item) => item.economic_date.slice(0,7) === monthRow.month && item.food_verdict === monthRow.stream);
    if (group.length !== Number(monthRow.event_count)
      || group.filter((item) => item.gross_amount_status === "KNOWN").length !== Number(monthRow.known_count)
      || group.filter((item) => item.gross_amount_status === "PARTIAL").length !== Number(monthRow.lower_bound_count)
      || group.reduce((sum, item) => sum + cents(item.gross_exact_amount ?? item.lower_bound_minimum), 0) !== cents(monthRow.minimum_total)) {
      throw new Error(`A2 monthly oracle mismatch at ${monthRow.month}/${monthRow.stream}`);
    }
  }
  for (const delta of a3Deltas) {
    const group = a3.filter((item) => item.month === delta.month && item.target_food_stream === delta.stream);
    if (group.length !== Number(delta.swile_event_count)
      || group.filter((item) => item.funding_mode === "BENEFIT_PLUS_BANK").length !== Number(delta.mixed_count)
      || group.reduce((sum, item) => sum + cents(item.exact_incremental_correction), 0) !== cents(delta.exact_incremental_correction)
      || group.reduce((sum, item) => sum + cents(item.lower_bound_incremental_minimum), 0) !== cents(delta.lower_bound_incremental_minimum)) {
      throw new Error(`A3 delta oracle mismatch at ${delta.month}/${delta.stream}`);
    }
  }
  const antiDouble = new Map(a3AntiDouble.map((item) => [item.metric, item.value]));
  for (const [metric, expected] of [["MIXED_MATCHED",54],["MIXED_UNMATCHED",0],["MIXED_CONFLICT",0],
    ["WALLET_CREDIT_COUNT",13],["WALLET_CREDIT_AMOUNT",2115],["NO_BANK_SOURCE_COUNT_FULL_DATASET",146],
    ["BENEFIT_PLUS_OTHER_EVENT_COUNT",1],["BANK_OUTFLOW_DELTA_EXPECTED",0],["WALLET_CREDIT_FOOD_DELTA",0]]) {
    if (Number(antiDouble.get(metric)) !== expected) throw new Error(`A3 anti-double oracle mismatch: ${metric}`);
  }
  const sourceById = new Map(sourceRows.map((row) => [row.swile_source_record_id, row]));
  const fundingByEvent = new Map();
  for (const row of fundingRows) {
    const items = fundingByEvent.get(row.purchase_event_id) ?? [];
    items.push(row);
    fundingByEvent.set(row.purchase_event_id, items);
  }
  const classificationsByEvent = new Map();
  for (const row of classificationRows) {
    const items = classificationsByEvent.get(row.purchase_event_id) ?? [];
    items.push(row);
    classificationsByEvent.set(row.purchase_event_id, items);
  }
  const householdId = required(sourceRows[0].household_id, "household");
  const sourceSystem = required(sourceRows[0].source_system, "source system");
  const sourceInstanceKey = required(sourceRows[0].source_instance_key, "source instance");
  const sourceSnapshotId = required(sourceRows[0].source_snapshot_id, "snapshot");
  if (sourceRows.some((row) => row.household_id !== householdId || row.source_system !== sourceSystem
    || row.source_instance_key !== sourceInstanceKey || row.source_snapshot_id !== sourceSnapshotId)) {
    throw new Error("Source rows cross Household/source/snapshot identity");
  }
  const records = sourceRows.map((row) => ({
    sourceReference: required(row.swile_source_record_id, "source record reference"),
    sourceKind: row.source_event_type === "Dépense" ? "PURCHASE" : row.source_event_type === "Crédit" ? "CREDIT" : "OTHER",
    fingerprint: required(row.source_fingerprint_sha256, "fingerprint"),
    occurrenceOrdinal: Number(row.source_occurrence_index),
    sourceDate: date(row.source_event_date),
    sourceTime: row.source_event_time ? String(row.source_event_time) : null,
    sourceNativeId: null,
    rawPayload: {
      worksheet: "Source_records", sourceExcelRow: row.source_excel_row,
      sourceEventType: row.source_event_type, merchantLabel: row.rawMerchantLabel,
      displayAmount: money(row.raw_display_amount),
      uberEatsFlag: row.uber_eats_flag, cardRelayFlag: row.card_relay_flag,
    },
  }));
  const purchases = purchaseRows.map((row) => {
    const reference = required(row.purchase_event_id, "purchase reference");
    const oracle = a2ById.get(reference), accounting = a3ById.get(reference);
    const sourceRow = sourceById.get(row.swile_source_record_id);
    if (!oracle || !accounting || !sourceRow || sourceRow.source_event_type !== "Dépense") {
      throw new Error(`Missing certified source/A2/A3 row for ${reference}`);
    }
    const status = required(row.gross_amount_status, "gross status");
    const amount = money(row.gross_amount_observed);
    const funding = (fundingByEvent.get(reference) ?? []).sort((a, b) => Number(a.funding_component_order) - Number(b.funding_component_order)).map((component) => ({
      kind: component.funding_kind === "OTHER_FUNDING" ? "OTHER" : component.funding_kind,
      ordinal: Number(component.funding_component_order), amount: money(component.amount),
      amountStatus: "KNOWN", currency: required(component.currency, "funding currency"),
    }));
    const bank = funding.find((part) => part.kind === "BANK_CARD");
    const certified = mixedById.get(reference);
    if (Boolean(bank) !== Boolean(certified)) throw new Error(`A3 mixed mapping differs for ${reference}`);
    if (bank && (certified.live_match_status !== "MATCHED" || certified.bank_operation_id !== accounting.bank_operation_id)) {
      throw new Error(`A3 bank Operation conflict for ${reference}`);
    }
    if (oracle.gross_amount_status !== status || money(accounting.purchase_gross_or_minimum) !== amount
      || oracle.purchase_channel !== row.purchase_channel
      || merchantName(oracle.normalizedMerchantName) !== merchantName(row.normalizedMerchantName)
      || money(oracle.swile_benefit_amount) !== money(row.swile_benefit_amount)
      || money(oracle.bank_complement_amount) !== money(row.bank_complement_amount)
      || money(oracle.other_funding_amount) !== money(row.other_funding_amount)) {
      throw new Error(`Raw/A2/A3 purchase mismatch for ${reference}`);
    }
    const classification = (classificationsByEvent.get(reference) ?? []).map((item) => ({
      axis: required(item.axis, "classification axis"), status: required(item.status, "classification status"),
      value: item.value ?? null, authority: item.authority ?? null,
      evidenceRefs: JSON.parse(item.evidence_refs || "[]"), provenance: required(item.provenance, "classification provenance"),
    }));
    const semanticPurpose = oracle.need_key === "repas_travail_adrien" ? "WORK_LUNCH" : null;
    return {
      sourceReference: row.swile_source_record_id, oracleReference: reference,
      economicDate: required(row.economic_date, "economic date"),
      grossAmount: amount, grossStatus: status, currency: "EUR",
      owner: bank ? { kind: "operation", operationId: certified.bank_operation_id } : { kind: "purchase_component" },
      funding, channel: required(row.purchase_channel, "channel"),
      merchant: { id: row.merchant_id, name: merchantName(row.normalizedMerchantName) },
      categoryId: row.category_id ?? null, subcategoryId: row.subcategory_id ?? null,
      needId: row.need_id ?? null, semanticPurpose, classifications: classification,
      oracle: { foodVerdict: oracle.food_verdict, a3Treatment: accounting.food_action,
        a3OperationId: accounting.bank_operation_id ?? null, a2SubcategoryKey: oracle.subcategory_key,
        a2NeedKey: oracle.need_key ?? null },
    };
  });
  const credits = records.filter((record) => record.sourceKind === "CREDIT").map((record) => ({
    sourceReference: record.sourceReference,
    amount: money(Math.abs(Number(sourceById.get(record.sourceReference).raw_display_amount))),
    currency: "EUR", eventDate: record.sourceDate, eventTime: record.sourceTime,
  }));
  const coverageStart = records.map((record) => record.sourceDate).sort()[0];
  const coverageEnd = records.map((record) => record.sourceDate).sort().at(-1);
  if (coverageStart !== "2025-08-01" || coverageEnd !== "2026-08-29") {
    throw new Error(`Source-supported wallet coverage changed: ${coverageStart} through ${coverageEnd}`);
  }
  return {
    batch: { householdId, sourceSystem, provider: sourceSystem, sourceInstanceKey,
      sourceSnapshotId, sourceSha256, formatVersion: "SWILE_IMPORT_CONTRACT_V2",
      coverageStart, coverageEnd, coverageStatus: "PARTIAL" },
    wallet: { walletType: "MEAL_VOUCHER_ACCOUNT", currency: "EUR", coverageStart, coverageEnd },
    records, purchases, credits,
  };
}
