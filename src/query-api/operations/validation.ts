import {
  parseCategoryId,
  parseMerchantId,
  parseOperationId,
  parsePlaceId,
  parseSubcategoryId,
} from "../../core/identity";
import { parseLocalDate } from "../../core/time";
import {
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
} from "../../core/validation";
import { parseQueryCapabilities } from "../capabilities";
import { parseCursorPage } from "../collections";
import { parseMoneyEnvelope, parseReadModelSubject } from "../read-models";
import { parseOperationsBrowseParams, queryResourceKeys } from "../request";
import type { OperationReference, OperationRowReadModel, OperationsBrowseReadModel, OperationsFilterCapability } from "./types";

const quality = new Set(["complete", "partial", "conflict", "unknown"] as const);
const necessity = new Set(["Indispensable", "Contraint", "Ajustable", "Optionnel"] as const);
const fixedVariable = new Set(["fixed", "variable", "unknown"] as const);
const lifeScope = new Set(["Vie courante", "Hors quotidien"] as const);
const filterCapabilities = new Set([
  "category", "subcategory", "merchant", "place", "account", "precise_type",
  "necessity", "fixed_variable", "life_scope", "quality", "economic_amount",
] as const);

function label(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} doit être un libellé non vide.`);
  }
  return value.trim();
}

function reference<Id extends string>(
  value: unknown,
  parseId: (candidate: unknown) => Id,
  name: string,
): OperationReference<Id> {
  const record = parseStrictRecord(value, ["id", "label"], name);
  return {
    id: parseId(requireProperty(record, "id", name)),
    label: label(requireProperty(record, "label", name), `${name}.label`),
  };
}

function parseOperationRow(value: unknown): OperationRowReadModel {
  const record = parseStrictRecord(
    value,
    [
      "operationId",
      "bankDate",
      "bankLabel",
      "merchant",
      "account",
      "bankAmount",
      "economicNet",
      "economicTiming",
      "category",
      "subcategory",
      "preciseType",
      "necessity",
      "fixedVariable",
      "lifeScope",
      "canonicalPlace",
      "quality",
    ],
    "OperationRowReadModel",
  );
  const timingRecord = parseStrictRecord(
    requireProperty(record, "economicTiming", "OperationRowReadModel"),
    ["availability", "date"],
    "OperationEconomicTiming",
  );
  const availability = requireProperty(timingRecord, "availability", "OperationEconomicTiming");
  const economicTiming = availability === "known"
    ? {
        availability,
        date: parseLocalDate(requireProperty(timingRecord, "date", "OperationEconomicTiming")),
      } as const
    : availability === "unknown"
      ? (parseStrictRecord(timingRecord, ["availability"], "OperationEconomicTiming"), { availability } as const)
      : (() => { throw new TypeError("OperationEconomicTiming.availability est invalide."); })();
  let account: OperationRowReadModel["account"];
  if (hasOwn(record, "account")) {
    const item = parseStrictRecord(record.account, ["id", "label"], "OperationAccount");
    account = {
      id: label(requireProperty(item, "id", "OperationAccount"), "OperationAccount.id"),
      label: label(requireProperty(item, "label", "OperationAccount"), "OperationAccount.label"),
    };
  }
  return {
    operationId: parseOperationId(requireProperty(record, "operationId", "OperationRowReadModel")),
    bankDate: parseLocalDate(requireProperty(record, "bankDate", "OperationRowReadModel")),
    bankLabel: label(requireProperty(record, "bankLabel", "OperationRowReadModel"), "OperationRowReadModel.bankLabel"),
    ...(hasOwn(record, "merchant") ? { merchant: reference(record.merchant, parseMerchantId, "OperationMerchant") } : {}),
    ...(account === undefined ? {} : { account }),
    bankAmount: parseMoneyEnvelope(requireProperty(record, "bankAmount", "OperationRowReadModel")),
    economicNet: parseMoneyEnvelope(requireProperty(record, "economicNet", "OperationRowReadModel")),
    economicTiming,
    ...(hasOwn(record, "category") ? { category: reference(record.category, parseCategoryId, "OperationCategory") } : {}),
    ...(hasOwn(record, "subcategory") ? { subcategory: reference(record.subcategory, parseSubcategoryId, "OperationSubcategory") } : {}),
    ...(hasOwn(record, "preciseType") ? { preciseType: label(record.preciseType, "preciseType") } : {}),
    ...(hasOwn(record, "necessity") ? { necessity: parseStringLiteral<NonNullable<OperationRowReadModel["necessity"]>>(record.necessity, necessity, "necessity") } : {}),
    ...(hasOwn(record, "fixedVariable") ? { fixedVariable: parseStringLiteral<NonNullable<OperationRowReadModel["fixedVariable"]>>(record.fixedVariable, fixedVariable, "fixedVariable") } : {}),
    ...(hasOwn(record, "lifeScope") ? { lifeScope: parseStringLiteral<NonNullable<OperationRowReadModel["lifeScope"]>>(record.lifeScope, lifeScope, "lifeScope") } : {}),
    ...(hasOwn(record, "canonicalPlace") ? { canonicalPlace: reference(record.canonicalPlace, parsePlaceId, "OperationPlace") } : {}),
    quality: parseStringLiteral(requireProperty(record, "quality", "OperationRowReadModel"), quality, "quality"),
  };
}

export function parseOperationsBrowseReadModel(value: unknown): OperationsBrowseReadModel {
  const record = parseStrictRecord(
    value,
    ["subject", "page", "appliedQuery", "capabilities", "filterCapabilities"],
    "OperationsBrowseReadModel",
  );
  return {
    subject: parseReadModelSubject(requireProperty(record, "subject", "OperationsBrowseReadModel")),
    page: parseCursorPage(requireProperty(record, "page", "OperationsBrowseReadModel"), parseOperationRow),
    appliedQuery: parseOperationsBrowseParams(requireProperty(record, "appliedQuery", "OperationsBrowseReadModel")),
    capabilities: parseQueryCapabilities(
      requireProperty(record, "capabilities", "OperationsBrowseReadModel"),
      queryResourceKeys.operationsBrowse,
    ),
    filterCapabilities: (() => {
      const values = requireProperty(record, "filterCapabilities", "OperationsBrowseReadModel");
      if (!Array.isArray(values)) throw new TypeError("filterCapabilities doit être un tableau.");
      return [...new Set(values.map((value) => parseStringLiteral<OperationsFilterCapability>(value, filterCapabilities, "OperationsFilterCapability")))].sort();
    })(),
  };
}
