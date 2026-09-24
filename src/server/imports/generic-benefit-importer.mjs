import crypto from "node:crypto";

const provenance = "STRUCTURED_CANONICAL_SOURCE";
export const deterministicBenefitId = (role, ...parts) => {
  const bytes = crypto.createHash("sha256").update(JSON.stringify(["generic-benefit-import-v1", role, ...parts])).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};
const uuid = deterministicBenefitId;
const cents = (value) => Math.round(Number(value) * 100);
const fail = (reason) => { throw new Error(reason); };
const query = (db, sql, values = []) => db.query(sql, values);

/**
 * Provider-neutral contract: batch, wallet, records, purchases, credits.
 * The adapter supplies evidence, taxonomy, certified owner Operation IDs and
 * funding. This layer never branches on a provider or source worksheet label.
 */
export async function importBenefitSnapshot(db, dto) {
  const { batch, wallet, records, purchases, credits } = dto;
  const scope = [batch.householdId, batch.sourceSystem, batch.sourceInstanceKey];
  const batchId = uuid("batch", ...scope, batch.sourceSnapshotId, batch.sourceSha256);
  const walletId = uuid("wallet", batch.householdId, batch.provider, batch.sourceInstanceKey, wallet.currency);
  const sourceId = (record) => uuid("source", ...scope, batch.sourceSnapshotId, record.fingerprint, record.occurrenceOrdinal);
  const recordByReference = new Map(records.map((record) => [record.sourceReference, record]));
  if (recordByReference.size !== records.length) fail("Duplicate adapter source reference");
  const identity = new Set(records.map((record) => `${record.fingerprint}:${record.occurrenceOrdinal}`));
  if (identity.size !== records.length) fail("Duplicate source fingerprint/occurrence identity");
  if (purchases.some((purchase) => recordByReference.get(purchase.sourceReference)?.sourceKind !== "PURCHASE")) fail("Purchase/source kind mismatch");
  if (credits.some((credit) => recordByReference.get(credit.sourceReference)?.sourceKind !== "CREDIT")) fail("Credit/source kind mismatch");
  const purchasesByReference = new Map(purchases.map((purchase) => [purchase.sourceReference, purchase]));
  if (purchasesByReference.size !== purchases.length) fail("Duplicate purchase source reference");
  const operationOwners = new Set();
  for (const purchase of purchases) {
    const bankParts = purchase.funding.filter((part) => part.kind === "BANK_CARD");
    if (bankParts.length > 1 || (bankParts.length === 1) !== (purchase.owner.kind === "operation")) fail("Owner/funding conflict");
    if (purchase.owner.kind === "operation") {
      if (!purchase.owner.operationId || operationOwners.has(purchase.owner.operationId)) fail("Operation owner conflict");
      operationOwners.add(purchase.owner.operationId);
    }
    if (!purchase.funding.some((part) => part.kind === "BENEFIT_WALLET")) fail("Missing Benefit funding");
    const total = purchase.funding.reduce((sum, part) => sum + cents(part.amount), 0);
    if (total > cents(purchase.grossAmount)) fail("Observed funding exceeds purchase gross/minimum");
    if (purchase.grossStatus === "KNOWN" && total !== cents(purchase.grossAmount)) fail("Known gross/funding mismatch");
  }
  const existing = await query(db, `select import_batch_id,file_hash,source_snapshot_id from public.import_batches
    where household_id=$1 and source_system=$2 and source_instance_key=$3`, scope);
  if (existing.rows.length > 0) {
    const exact = existing.rows.find((row) => row.source_snapshot_id === batch.sourceSnapshotId && row.file_hash === batch.sourceSha256);
    if (exact && existing.rows.length === 1) {
      const sourceCount = await query(db, `select count(*)::integer as count from public.external_source_records where import_batch_id=$1`, [exact.import_batch_id]);
      const purchaseCount = await query(db, `select count(*)::integer as count from public.purchase_events p
        join public.external_source_records s on s.external_source_record_id=p.gross_source_record_id
        where s.import_batch_id=$1`, [exact.import_batch_id]);
      if (Number(sourceCount.rows[0].count) !== records.length || Number(purchaseCount.rows[0].count) !== purchases.length) {
        return { status: "REQUIRES_RECONCILIATION", batchId: exact.import_batch_id, inserts: 0, updates: 0, deletes: 0 };
      }
      return { status: "EXACT_REPLAY", batchId: exact.import_batch_id, inserts: 0, updates: 0, deletes: 0 };
    }
    return { status: "REQUIRES_RECONCILIATION", batchId: null, inserts: 0, updates: 0, deletes: 0 };
  }
  let inserts = 0;
  const put = async (sql, values) => { await query(db, sql, values); inserts++; };
  await query(db, "begin");
  try {
    await put(`insert into public.import_batches
      (import_batch_id,household_id,source_system,file_hash,period_start,period_end,source_instance_key,source_snapshot_id,coverage_status)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [batchId,batch.householdId,batch.sourceSystem,batch.sourceSha256,batch.coverageStart,batch.coverageEnd,
        batch.sourceInstanceKey,batch.sourceSnapshotId,batch.coverageStatus]);
    for (const record of records) {
      await put(`insert into public.external_source_records
        (external_source_record_id,household_id,import_batch_id,source_system,source_instance_key,source_snapshot_id,
          source_record_kind,source_native_id,source_native_id_status,source_fingerprint_sha256,occurrence_ordinal,
          source_date,source_time,raw_payload,provenance)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15)`,
        [sourceId(record),batch.householdId,batchId,batch.sourceSystem,batch.sourceInstanceKey,batch.sourceSnapshotId,
          record.sourceKind,record.sourceNativeId,record.sourceNativeId ? "KNOWN" : "UNAVAILABLE",
          record.fingerprint,record.occurrenceOrdinal,
          record.sourceDate,record.sourceTime,JSON.stringify(record.rawPayload),provenance]);
    }
    await put(`insert into public.benefit_wallets
      (benefit_wallet_id,household_id,provider,source_instance_key,wallet_type,currency,coverage_start,coverage_end,
        opening_balance_status,closing_balance_status,import_batch_id,status,provenance)
      values ($1,$2,$3,$4,$5,$6,$7,$8,'UNKNOWN','UNKNOWN',$9,'UNKNOWN',$10)`,
      [walletId,batch.householdId,batch.provider,batch.sourceInstanceKey,wallet.walletType,wallet.currency,
        wallet.coverageStart,wallet.coverageEnd,batchId,provenance]);
    for (const purchase of purchases) {
      const source = recordByReference.get(purchase.sourceReference);
      const externalId = sourceId(source);
      const eventId = uuid("purchase", externalId);
      const ownerId = purchase.owner.kind === "operation"
        ? purchase.owner.operationId : uuid("purchase-component", eventId);
      const ownerKey = `${purchase.owner.kind}:${ownerId}`;
      await put(`insert into public.purchase_events
        (purchase_event_id,household_id,provenance,gross_amount,gross_amount_status,gross_currency,
          gross_source_record_id,gross_evidence_refs,purchase_visibility,merchant_id,category_id,subcategory_id,
          need_id,semantic_purpose)
        values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'PURCHASE_AWARE_PILOT',$9,$10,$11,$12,$13)`,
        [eventId,batch.householdId,provenance,purchase.grossAmount,purchase.grossStatus,purchase.currency,
          externalId,JSON.stringify([`source:${externalId}`]),purchase.merchant.id,purchase.categoryId,
          purchase.subcategoryId,purchase.needId,purchase.semanticPurpose]);
      if (purchase.owner.kind === "purchase_component") {
        await put(`insert into public.purchase_economic_components
          (purchase_economic_component_id,household_id,purchase_event_id,merchant_id,category_id,subcategory_id,need_id,provenance)
          values ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [ownerId,batch.householdId,eventId,purchase.merchant.id,purchase.categoryId,purchase.subcategoryId,
            purchase.needId,provenance]);
      }
      await put(`insert into public.purchase_event_memberships
        (purchase_event_membership_id,purchase_event_id,household_id,membership_kind,operation_id,
          purchase_economic_component_id,evidence_refs,provenance)
        values ($1,$2,$3,'CONSUMPTION_COMPONENT',$4,$5,$6::jsonb,$7)`,
        [uuid("membership",eventId,ownerKey),eventId,batch.householdId,
          purchase.owner.kind === "operation" ? ownerId : null,
          purchase.owner.kind === "purchase_component" ? ownerId : null,
          JSON.stringify([`source:${externalId}`,`owner:${ownerKey}`]),provenance]);
      await put(`insert into public.purchase_event_timing_assertions
        (purchase_event_timing_assertion_id,purchase_event_id,household_id,timing_authority,timing_precision,
          economic_date,economic_month,evidence_refs,provenance,is_active)
        values ($1,$2,$3,'TRUSTED_PURCHASE_SOURCE','DAY',$4,$5,$6::jsonb,$7,true)`,
        [uuid("timing",eventId),eventId,batch.householdId,purchase.economicDate,
          `${purchase.economicDate.slice(0,7)}-01`,JSON.stringify([`source:${externalId}`]),provenance]);
      await put(`insert into public.purchase_event_channel_assertions
        (purchase_event_channel_assertion_id,household_id,purchase_event_id,channel,status,evidence_refs,provenance)
        values ($1,$2,$3,$4,'KNOWN',$5::jsonb,$6)`,
        [uuid("channel",eventId),batch.householdId,eventId,purchase.channel,
          JSON.stringify([`source:${externalId}`]),provenance]);
      for (const classification of purchase.classifications) {
        await put(`insert into public.economic_component_classifications
          (economic_component_classification_id,household_id,operation_id,purchase_economic_component_id,
            axis,status,value,authority,evidence_refs,provenance)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
          [uuid("classification",ownerKey,classification.axis),batch.householdId,
            purchase.owner.kind === "operation" ? ownerId : null,
            purchase.owner.kind === "purchase_component" ? ownerId : null,
            classification.axis,classification.status,classification.value,classification.authority,
            JSON.stringify(classification.evidenceRefs),classification.provenance]);
      }
      let benefitFundingId = null;
      for (const part of purchase.funding) {
        const fundingId = uuid("funding",eventId,part.ordinal);
        if (part.kind === "BENEFIT_WALLET") benefitFundingId = fundingId;
        await put(`insert into public.purchase_funding_components
          (purchase_funding_component_id,household_id,purchase_event_id,component_ordinal,funding_kind,
            amount,amount_status,currency,benefit_wallet_id,bank_operation_id,external_source_record_id,provenance)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [fundingId,batch.householdId,eventId,part.ordinal,part.kind,part.amount,part.amountStatus,part.currency,
            part.kind === "BENEFIT_WALLET" ? walletId : null,
            part.kind === "BANK_CARD" ? purchase.owner.operationId : null,externalId,provenance]);
      }
      const benefit = purchase.funding.find((part) => part.kind === "BENEFIT_WALLET");
      await put(`insert into public.benefit_wallet_ledger_entries
        (benefit_wallet_ledger_entry_id,household_id,benefit_wallet_id,external_source_record_id,entry_ordinal,
          entry_kind,amount,currency,event_date,event_time,purchase_event_id,purchase_funding_component_id,provenance)
        values ($1,$2,$3,$4,1,'PURCHASE_DEBIT',$5,$6,$7,$8,$9,$10,$11)`,
        [uuid("ledger-debit",externalId),batch.householdId,walletId,externalId,benefit.amount,benefit.currency,
          source.sourceDate,source.sourceTime,eventId,benefitFundingId,provenance]);
    }
    for (const credit of credits) {
      const source = recordByReference.get(credit.sourceReference);
      const externalId = sourceId(source);
      await put(`insert into public.benefit_wallet_ledger_entries
        (benefit_wallet_ledger_entry_id,household_id,benefit_wallet_id,external_source_record_id,entry_ordinal,
          entry_kind,amount,currency,event_date,event_time,provenance)
        values ($1,$2,$3,$4,1,'CREDIT',$5,$6,$7,$8,$9)`,
        [uuid("ledger-credit",externalId),batch.householdId,walletId,externalId,
          credit.amount,credit.currency,credit.eventDate,credit.eventTime,provenance]);
    }
    await query(db, "commit");
    return { status: "IMPORTED", batchId, walletId, inserts, updates: 0, deletes: 0 };
  } catch (error) {
    await query(db, "rollback");
    throw error;
  }
}
