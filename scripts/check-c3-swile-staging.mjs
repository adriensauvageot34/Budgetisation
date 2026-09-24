import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Module, { createRequire } from "node:module";
import ts from "typescript";
import { adaptSwileWorkbook } from "./swile-source-adapter.mjs";
import { deterministicBenefitId as id, importBenefitSnapshot } from "../src/server/imports/generic-benefit-importer.mjs";

const [sourcePath, masterPath, reportPath] = process.argv.slice(2);
if (!sourcePath || !masterPath || !reportPath) {
  throw new Error("Usage: node scripts/check-c3-swile-staging.mjs <source.xlsx> <master.xlsx> <report.json>");
}
const modulePath = process.env.PGLITE_MODULE_PATH;
if (!modulePath) throw new Error("PGLITE_MODULE_PATH must name the disposable PGlite dist/index.js");
const { PGlite } = await import(pathToFileURL(modulePath).href);
const dto = await adaptSwileWorkbook(sourcePath, masterPath);
const repo = path.resolve(import.meta.dirname, "..");
const q = (db, sql, params = []) => db.query(sql, params);
const scalar = async (db, sql, params = []) => (await q(db, sql, params)).rows[0]?.value;

const base = `
create role anon; create role authenticated; create role service_role;
create schema private;
create table public.households (household_id uuid primary key);
create table public.canonical_household_scope_control (household_id uuid, household_count bigint, status text);
create table public.persons (person_id uuid primary key, household_id uuid not null references public.households);
create table public.bank_accounts (bank_account_id uuid primary key);
create table public.import_batches (
  import_batch_id uuid primary key, household_id uuid not null references public.households,
  bank_account_id uuid references public.bank_accounts, source_system text not null,
  file_hash text not null, period_start date, period_end date,
  imported_at timestamptz default now(), status text,
  unique (household_id, source_system, file_hash)
);
create table public.operations (operation_id uuid primary key, montant_bancaire_depense numeric(18,2));
create table public.operation_allocations (allocation_id uuid primary key);
create table public.operation_items (item_id uuid primary key);
create table public.payment_components (payment_component_id uuid primary key);
create table public.cash_economic_uses (cash_use_id uuid primary key);
create table public.merchants (merchant_id uuid primary key);
create table public.categories (category_id uuid primary key);
create table public.subcategories (subcategory_id uuid primary key);
create table public.needs (need_id uuid primary key);
`;
const migrations = [
  "20260829231059_purchase_event_identity.sql",
  "20260829231101_economic_component_classifications.sql",
  "20260925003500_generic_benefit_purchase_foundation.sql",
  "20260925113000_purchase_event_visibility_scope.sql",
  "20260925153000_purchase_event_semantic_context.sql",
];
async function setup(db) {
  await db.exec(base);
  for (const name of migrations) await db.exec(await fs.readFile(path.join(repo, "supabase/migrations", name), "utf8"));
  const h = dto.batch.householdId;
  await q(db, "insert into public.households values ($1)", [h]);
  await q(db, "insert into public.canonical_household_scope_control values ($1,1,'READY')", [h]);
  // These IDs and bank amounts are the certified 54 existing Operations in A3.
  for (const purchase of dto.purchases.filter((purchase) => purchase.owner.kind === "operation")) {
    const bank = purchase.funding.find((part) => part.kind === "BANK_CARD");
    await q(db, "insert into public.operations values ($1,$2)", [purchase.owner.operationId, bank.amount]);
  }
  const refs = [
    ["merchants", "merchant_id", dto.purchases.map((purchase) => purchase.merchant.id)],
    ["categories", "category_id", dto.purchases.map((purchase) => purchase.categoryId)],
    ["subcategories", "subcategory_id", dto.purchases.map((purchase) => purchase.subcategoryId)],
    ["needs", "need_id", dto.purchases.map((purchase) => purchase.needId)],
  ];
  for (const [table, column, values] of refs) for (const value of new Set(values.filter(Boolean))) {
    await q(db, `insert into public.${table} (${column}) values ($1)`, [value]);
  }
}
const sourceIdentity = (record) => id("source", dto.batch.householdId, dto.batch.sourceSystem,
  dto.batch.sourceInstanceKey, dto.batch.sourceSnapshotId, record.fingerprint, record.occurrenceOrdinal);
const statusCounts = (items, key) => Object.fromEntries([...new Set(items.map((item) => item[key]))].map((value) => [value, items.filter((item) => item[key] === value).length]));
const cents = (amount) => Math.round(Number(amount) * 100);
const sum = (items, get) => items.reduce((total, item) => total + cents(get(item)), 0);
const isoDate = (value) => value instanceof Date ? value.toISOString().slice(0,10) : String(value).slice(0,10);

function verifySource() {
  assert.equal(dto.records.length, 213);
  assert.equal(dto.purchases.length, 200);
  assert.equal(dto.credits.length, 13);
  assert.equal(dto.records.filter((record) => record.sourceKind === "PURCHASE").length, 200);
  const fingerprintGroups = Map.groupBy(dto.records, (record) => record.fingerprint);
  assert.equal(fingerprintGroups.size, 212);
  assert.deepEqual([...fingerprintGroups.values()].filter((group) => group.length > 1).map((group) => group.length), [2]);
  assert.deepEqual(statusCounts(dto.purchases, "grossStatus"), { KNOWN: 184, PARTIAL: 16 });
  assert.deepEqual(statusCounts(dto.purchases, "channel"), { DIRECT_OR_IN_PERSON: 191, UBER_EATS: 9 });
  assert.equal(dto.purchases.reduce((count, purchase) => count + purchase.funding.length, 0), 255);
  assert.equal(dto.purchases.filter((purchase) => purchase.owner.kind === "operation").length, 54);
  assert.equal(dto.purchases.filter((purchase) => purchase.owner.kind === "purchase_component").length, 146);
  assert.equal(sum(dto.purchases.filter((purchase) => purchase.grossStatus === "KNOWN"), (purchase) => purchase.grossAmount), 323958);
  assert.equal(sum(dto.purchases.filter((purchase) => purchase.grossStatus === "PARTIAL"), (purchase) => purchase.grossAmount), 17881);
  assert.equal(sum(dto.credits, (credit) => credit.amount), 211500);
  const allFunding = dto.purchases.flatMap((purchase) => purchase.funding);
  for (const [kind, count, total] of [["BENEFIT_WALLET",200,201807],["BANK_CARD",54,138032],["OTHER",1,2000]]) {
    const parts = allFunding.filter((part) => part.kind === kind);
    assert.equal(parts.length, count);
    assert.equal(sum(parts, (part) => part.amount), total);
  }
  const uber = dto.purchases.filter((purchase) => purchase.channel === "UBER_EATS");
  assert.ok(uber.every((purchase) => purchase.merchant.name.toLowerCase() !== "uber eats"));
  assert.equal(dto.purchases.filter((purchase) => purchase.semanticPurpose === "WORK_LUNCH").length, 36);
}

async function tableStats(db) {
  const names = ["import_batches", "external_source_records", "purchase_events", "benefit_wallets",
    "purchase_funding_components", "purchase_economic_components", "purchase_event_memberships",
    "benefit_wallet_ledger_entries", "purchase_event_timing_assertions", "purchase_event_channel_assertions",
    "economic_component_classifications"];
  const counts = {};
  for (const name of names) counts[name] = Number(await scalar(db, `select count(*)::integer value from public.${name}`));
  assert.deepEqual(counts, {
    import_batches: 1, external_source_records: 213, purchase_events: 200, benefit_wallets: 1,
    purchase_funding_components: 255, purchase_economic_components: 146, purchase_event_memberships: 200,
    benefit_wallet_ledger_entries: 213, purchase_event_timing_assertions: 200,
    purchase_event_channel_assertions: 200, economic_component_classifications: 600,
  });
  assert.equal(Number(await scalar(db, `select count(*)::integer value from public.purchase_events where gross_amount_status='KNOWN'`)), 184);
  assert.equal(Number(await scalar(db, `select count(*)::integer value from public.purchase_events where gross_amount_status='PARTIAL'`)), 16);
  assert.equal(Number(await scalar(db, `select count(*)::integer value from public.purchase_events where purchase_visibility='DEFAULT'`)), 0);
  assert.equal(Number(await scalar(db, `select count(*)::integer value from public.purchase_events where purchase_visibility='PURCHASE_AWARE_PILOT'`)), 200);
  assert.equal(Number(await scalar(db, `select count(*)::integer value from public.purchase_event_memberships where operation_id is not null`)), 54);
  assert.equal(Number(await scalar(db, `select count(*)::integer value from public.purchase_event_memberships where purchase_economic_component_id is not null`)), 146);
  assert.equal(Number(await scalar(db, `select count(*)::integer value from public.purchase_events p left join public.purchase_event_memberships m using(purchase_event_id) group by p.purchase_event_id having count(m.purchase_event_membership_id) <> 1 limit 1`)) || 0, 0);
  assert.equal(Number(await scalar(db, `select count(*)::integer value from public.benefit_wallet_ledger_entries where entry_kind='CREDIT'`)), 13);
  assert.equal(Number(await scalar(db, `select count(*)::integer value from public.benefit_wallet_ledger_entries where entry_kind='PURCHASE_DEBIT'`)), 200);
  assert.equal(Number(await scalar(db, `select count(*)::integer value from public.purchase_event_channel_assertions where channel='UBER_EATS'`)), 9);
  assert.equal(Number(await scalar(db, `select count(*)::integer value from public.external_source_records
    group by source_fingerprint_sha256 having count(*)=2 limit 1`)), 2);
  for (const [where, expected] of [["gross_amount_status='KNOWN'",323958],["gross_amount_status='PARTIAL'",17881]]) {
    const amount = await scalar(db, `select coalesce(sum(gross_amount),0)::text value from public.purchase_events where ${where}`);
    assert.equal(cents(amount), expected);
  }
  for (const [kind, expected] of [["BENEFIT_WALLET",201807],["BANK_CARD",138032],["OTHER",2000]]) {
    const amount = await scalar(db, `select coalesce(sum(amount),0)::text value from public.purchase_funding_components where funding_kind='${kind}'`);
    assert.equal(cents(amount), expected);
  }
  for (const [kind, expected] of [["CREDIT",211500],["PURCHASE_DEBIT",201807]]) {
    const amount = await scalar(db, `select coalesce(sum(amount),0)::text value from public.benefit_wallet_ledger_entries where entry_kind='${kind}'`);
    assert.equal(cents(amount), expected);
  }
  const wallet = (await q(db, "select coverage_start,coverage_end,opening_balance,opening_balance_status,closing_balance,closing_balance_status from public.benefit_wallets")).rows[0];
  assert.equal(wallet.opening_balance, null); assert.equal(wallet.closing_balance, null);
  assert.equal(wallet.opening_balance_status, "UNKNOWN"); assert.equal(wallet.closing_balance_status, "UNKNOWN");
  assert.equal(isoDate(wallet.coverage_start), "2025-08-01");
  assert.equal(isoDate(wallet.coverage_end), "2026-08-29");
  return counts;
}

async function digest(db) {
  const specs = [
    ["import_batches","import_batch_id"],["external_source_records","external_source_record_id"],
    ["purchase_events","purchase_event_id"],["benefit_wallets","benefit_wallet_id"],
    ["purchase_funding_components","purchase_funding_component_id"],
    ["purchase_economic_components","purchase_economic_component_id"],
    ["purchase_event_memberships","purchase_event_membership_id"],
    ["benefit_wallet_ledger_entries","benefit_wallet_ledger_entry_id"],
    ["purchase_event_timing_assertions","purchase_event_timing_assertion_id"],
    ["purchase_event_channel_assertions","purchase_event_channel_assertion_id"],
    ["economic_component_classifications","economic_component_classification_id"],
  ];
  const normalized = [];
  for (const [name, key] of specs) {
    const result = await q(db, `select to_jsonb(t) - 'created_at' - 'updated_at' - 'imported_at' as row from public.${name} t order by ${key}`);
    normalized.push([name, result.rows.map((item) => item.row)]);
  }
  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function reconciliationRows() {
  const sourceByReference = new Map(dto.records.map((record) => [record.sourceReference, record]));
  const keyBySubcategory = new Map();
  for (const purchase of dto.purchases) {
    const previous = keyBySubcategory.get(purchase.subcategoryId);
    if (previous && previous !== purchase.oracle.a2SubcategoryKey) throw new Error("Inconsistent generic subcategory mapping");
    keyBySubcategory.set(purchase.subcategoryId, purchase.oracle.a2SubcategoryKey);
  }
  const verdict = (purchase) => {
    const key = keyBySubcategory.get(purchase.subcategoryId);
    if (key === "alimentation__courses_alimentaires") return "COURSES";
    if (key === "restauration__livraison_de_repas") return "DELIVERY";
    if (["restauration__fast_food_snack", "restauration__restaurant"].includes(key)) return "RESTAURANT";
    if (key === "alimentation__boulangerie" && purchase.semanticPurpose === "WORK_LUNCH") return "RESTAURANT";
    return "OUT_OF_FOOD";
  };
  const report = dto.purchases.map((purchase) => {
    const source = sourceByReference.get(purchase.sourceReference);
    const externalId = sourceIdentity(source);
    const eventId = id("purchase", externalId);
    const ownerId = purchase.owner.kind === "operation" ? purchase.owner.operationId : id("purchase-component", eventId);
    const genericVerdict = verdict(purchase);
    assert.equal(genericVerdict, purchase.oracle.foodVerdict);
    assert.equal(purchase.owner.kind === "operation" ? ownerId : null, purchase.oracle.a3OperationId);
    return {
      sourceExcelRow: source.rawPayload.sourceExcelRow, sourceFingerprint: source.fingerprint,
      rawMerchantLabel: source.rawPayload.merchantLabel,
      occurrenceOrdinal: source.occurrenceOrdinal, externalSourceRecordId: externalId,
      purchaseEventId: eventId, certifiedPurchaseReference: purchase.oracleReference,
      owner: { kind: purchase.owner.kind, id: ownerId }, gross: { amount: purchase.grossAmount,
        status: purchase.grossStatus === "PARTIAL" ? "LOWER_BOUND" : "KNOWN" },
      funding: purchase.funding.map((part) => ({ kind: part.kind, amount: part.amount,
        fundingComponentId: id("funding", eventId, part.ordinal) })),
      classification: { merchantId: purchase.merchant.id, categoryId: purchase.categoryId,
        subcategoryId: purchase.subcategoryId, needId: purchase.needId,
        semanticPurpose: purchase.semanticPurpose, axes: purchase.classifications.map((item) => item.axis) },
      genericFoodVerdict: genericVerdict, a2ExpectedFoodVerdict: purchase.oracle.foodVerdict,
      a3AccountingTreatment: purchase.oracle.a3Treatment,
    };
  });
  assert.equal(new Set(report.map((row) => row.externalSourceRecordId)).size, 200);
  assert.equal(new Set(report.map((row) => row.purchaseEventId)).size, 200);
  assert.deepEqual(statusCounts(report, "genericFoodVerdict"), {
    COURSES: 47, OUT_OF_FOOD: 81, RESTAURANT: 64, DELIVERY: 8,
  });
  return report;
}

async function verifyReconciliationDb(db, report) {
  const events = (await q(db, `select p.purchase_event_id,p.gross_amount::text,p.gross_amount_status,
      p.category_id,p.subcategory_id,p.need_id,p.merchant_id,p.semantic_purpose,
      s.external_source_record_id,s.source_fingerprint_sha256,s.occurrence_ordinal,
      m.operation_id,m.purchase_economic_component_id
    from public.purchase_events p
    join public.external_source_records s on s.external_source_record_id=p.gross_source_record_id
    join public.purchase_event_memberships m on m.purchase_event_id=p.purchase_event_id`)).rows;
  const byEvent = new Map(events.map((event) => [event.purchase_event_id,event]));
  assert.equal(byEvent.size, report.length);
  const fundings = (await q(db, `select purchase_event_id,purchase_funding_component_id,funding_kind,
    amount::text from public.purchase_funding_components`)).rows;
  const fundingByEvent = Map.groupBy(fundings, (funding) => funding.purchase_event_id);
  for (const row of report) {
    const actual = byEvent.get(row.purchaseEventId);
    assert.ok(actual);
    assert.equal(actual.external_source_record_id, row.externalSourceRecordId);
    assert.equal(actual.source_fingerprint_sha256, row.sourceFingerprint);
    assert.equal(Number(actual.occurrence_ordinal), row.occurrenceOrdinal);
    assert.equal(cents(actual.gross_amount), cents(row.gross.amount));
    assert.equal(actual.gross_amount_status, row.gross.status === "LOWER_BOUND" ? "PARTIAL" : "KNOWN");
    assert.equal(actual.operation_id ?? actual.purchase_economic_component_id, row.owner.id);
    for (const field of ["categoryId", "subcategoryId", "needId", "merchantId", "semanticPurpose"]) {
      const sqlField = {categoryId:"category_id",subcategoryId:"subcategory_id",needId:"need_id",
        merchantId:"merchant_id",semanticPurpose:"semantic_purpose"}[field];
      assert.equal(actual[sqlField], row.classification[field]);
    }
    const actualFunding = fundingByEvent.get(row.purchaseEventId) ?? [];
    assert.equal(actualFunding.length, row.funding.length);
    for (const part of row.funding) {
      const found = actualFunding.find((funding) => funding.purchase_funding_component_id === part.fundingComponentId);
      assert.ok(found); assert.equal(found.funding_kind, part.kind);
      assert.equal(cents(found.amount), cents(part.amount));
    }
  }
}

// Reuse the production C2 projector, not a staging-only economic calculator.
const require = createRequire(import.meta.url);
const originalLoad = Module._load, originalResolve = Module._resolveFilename;
Module._load = function(request, parent, isMain) {
  return request === "server-only" ? {} : originalLoad.call(this, request, parent, isMain);
};
Module._resolveFilename = function(request, parent, isMain, options) {
  const target = request.startsWith("@/") ? path.resolve(repo, "src", request.slice(2)) : request;
  try { return originalResolve.call(this, target, parent, isMain, options); } catch (error) {
    if (path.extname(target)) throw error;
    for (const candidate of [`${target}.ts`, path.join(target, "index.ts")]) {
      try { return originalResolve.call(this, candidate, parent, isMain, options); } catch { /* next */ }
    }
    throw error;
  }
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(
  require("node:fs").readFileSync(filename, "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename },
).outputText, filename);
const { projectPurchaseAwareCanonical } = require(path.resolve(repo, "src/analytics/facts/purchase-aware.ts"));

async function projectionSmoke(db) {
  const events = (await q(db, `select p.purchase_event_id,p.household_id,p.gross_amount::text,p.gross_amount_status,
      p.category_id,p.subcategory_id,p.need_id,p.merchant_id,p.semantic_purpose,m.operation_id,m.purchase_economic_component_id,
      m.canonical_component_key,t.economic_date,t.economic_month
    from public.purchase_events p
    join public.purchase_event_memberships m using(purchase_event_id)
    join public.purchase_event_timing_assertions t using(purchase_event_id)
    where p.purchase_visibility='PURCHASE_AWARE_PILOT' order by p.purchase_event_id`)).rows;
  const operationRows = (await q(db, "select operation_id,montant_bancaire_depense::text bank_amount from public.operations")).rows;
  const bankById = new Map(operationRows.map((row) => [row.operation_id, row.bank_amount]));
  const purchases = events.map((row) => {
    const operation = Boolean(row.operation_id);
    const sourceId = operation ? row.operation_id : row.purchase_economic_component_id;
    return {
      purchaseEventId: row.purchase_event_id, householdId: row.household_id,
      grossAmount: row.gross_amount, grossAmountStatus: row.gross_amount_status,
      purchaseTaxonomy: { categoryId: row.category_id, subcategoryId: row.subcategory_id,
        needId: row.need_id, merchantId: row.merchant_id }, semanticPurpose: row.semantic_purpose,
      sources: [{ purchaseEventId: row.purchase_event_id, membershipKind: "CONSUMPTION_COMPONENT",
        kind: operation ? "operation" : "purchase_component", sourceId,
        canonicalComponentKey: row.canonical_component_key, evidenceRefs: ["staging:sql"], provenance: "STRUCTURED_CANONICAL_SOURCE" }],
      timingAssertions: [{ authority: "TRUSTED_PURCHASE_SOURCE", precision: "DAY",
        economicDate: isoDate(row.economic_date), economicMonth: isoDate(row.economic_month),
        evidenceRefs: ["staging:sql"] }],
      ...(operation ? { bankAmount: bankById.get(sourceId), operationCanonicalFactCount: 1,
        operationOwnerSourceKind: "Operation_parent" } : { nativeComponent: {
        purchaseComponentId: sourceId, canonicalComponentKey: row.canonical_component_key,
        purchaseEventId: row.purchase_event_id, categoryId: row.category_id,
        subcategoryId: row.subcategory_id, needId: row.need_id, merchantId: row.merchant_id,
      } }), classifications: [],
    };
  });
  const legacyFacts = operationRows.map((row) => ({ canonicalComponentKey: `operation:${row.operation_id}`,
    sourceOperation: { kind: "resolved", id: row.operation_id }, gross: row.bank_amount,
    fact: "fct_economic_component" }));
  const range = { start: "2025-08-01", endExclusive: "2026-09-01" };
  const defaultResult = projectPurchaseAwareCanonical({ visibility: "DEFAULT", householdId: dto.batch.householdId,
    range, legacyFacts, purchases });
  assert.deepEqual(defaultResult.facts, legacyFacts);
  const result = projectPurchaseAwareCanonical({ visibility: "PURCHASE_AWARE_PILOT", householdId: dto.batch.householdId,
    range, legacyFacts, purchases });
  assert.equal(result.status, "PASS"); assert.equal(result.facts.length, 200);
  assert.equal(result.facts.filter((fact) => fact.sourceOperation.kind === "resolved").length, 54);
  assert.equal(result.facts.filter((fact) => fact.sourceOperation.kind === "not_applicable").length, 146);
  assert.equal(result.facts.filter((fact) => fact.economicAmount.status === "KNOWN").length, 184);
  assert.equal(result.facts.filter((fact) => fact.economicAmount.status === "LOWER_BOUND").length, 16);
  assert.equal(result.facts.filter((fact) => fact.bankAmount.status === "NOT_APPLICABLE").length, 146);
  assert.equal(result.facts.filter((fact) => fact.semanticPurpose === "WORK_LUNCH").length, 36);
  assert.ok(result.facts.every((fact) => fact.taxonomy.categoryId && fact.taxonomy.subcategoryId && fact.taxonomy.merchantId));
  assert.equal(sum(result.facts, (fact) => fact.economicAmount.status === "KNOWN"
    ? fact.economicAmount.value : fact.economicAmount.minimum), 341839);
  return { pilotFacts: result.facts.length, defaultFacts: defaultResult.facts.length, blocking: result.blocking.length };
}

verifySource();
const reconciliation = reconciliationRows();
const db1 = new PGlite(), db2 = new PGlite();
try {
  await setup(db1);
  const first = await importBenefitSnapshot(db1, dto);
  assert.equal(first.status, "IMPORTED");
  const counts = await tableStats(db1);
  await verifyReconciliationDb(db1, reconciliation);
  const projection = await projectionSmoke(db1);
  const firstDigest = await digest(db1);
  const replay = await importBenefitSnapshot(db1, dto);
  assert.deepEqual([replay.status,replay.inserts,replay.updates,replay.deletes], ["EXACT_REPLAY",0,0,0]);
  assert.equal(await digest(db1), firstDigest);
  const changed = await importBenefitSnapshot(db1, { ...dto, batch: { ...dto.batch, sourceSha256: "0".repeat(64) } });
  assert.equal(changed.status, "REQUIRES_RECONCILIATION");
  await setup(db2);
  const second = await importBenefitSnapshot(db2, dto);
  assert.equal(second.status, "IMPORTED");
  assert.deepEqual(await tableStats(db2), counts);
  const secondDigest = await digest(db2);
  assert.equal(secondDigest, firstDigest);
  const report = { sourceWorkbookSha256: dto.batch.sourceSha256, batchId: first.batchId,
    firstImport: first, replay, changedSnapshot: changed.status, deterministicBusinessDigest: firstDigest,
    counts, projection, reconciliationCount: reconciliation.length, rows: reconciliation };
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ result: "PASS", sourceWorkbookSha256: dto.batch.sourceSha256,
    firstInserts: first.inserts, replayInserts: replay.inserts, deterministicBusinessDigest: firstDigest,
    reconciliationRows: reconciliation.length, counts, projection, reportPath }));
} finally {
  await Promise.all([db1.close(), db2.close()]);
}
