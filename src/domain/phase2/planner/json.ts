import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export type PlannerJson = null | boolean | number | string | readonly PlannerJson[] | PlannerJsonObject;
export type PlannerJsonObject = { readonly [key: string]: PlannerJson };

export function plannerRecord(value: unknown, code = "PLANNER_OBJECT_INVALID"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError(code);
  return value as Record<string, unknown>;
}

export function plannerKeys(value: Record<string, unknown>, allowed: readonly string[], required = allowed): void {
  if (Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(value, key)))
    throw new TypeError("PLANNER_FIELDS_INVALID");
}

export function plannerString(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 1024) throw new TypeError("PLANNER_STRING_INVALID");
  return value;
}

export function plannerUuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value))
    throw new TypeError("PLANNER_ID_INVALID");
  return value.toLowerCase();
}

/** Application months use YYYY-MM; persistence uses its first calendar day. */
export function plannerMonth(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9]\d{3}-(?:0[1-9]|1[0-2])$/u.test(value)) throw new TypeError("PLANNER_MONTH_INVALID");
  return value;
}

export function plannerDigestString(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) throw new TypeError("PLANNER_DIGEST_INVALID");
  return value;
}

export function plannerInteger(value: unknown, minimum = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) throw new TypeError("PLANNER_INTEGER_INVALID");
  return value;
}

/** Reject lossy/non-JSON input instead of converting undefined, NaN or class instances. */
export function parsePlannerJson(value: unknown, depth = 0): PlannerJson {
  if (depth > 32) throw new TypeError("PLANNER_JSON_DEPTH_INVALID");
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    if (value.length > 10000 || Array.from({ length: value.length }, (_, index) => index).some(index => !Object.hasOwn(value, index)))
      throw new TypeError("PLANNER_JSON_ARRAY_INVALID");
    return value.map(item => parsePlannerJson(item, depth + 1));
  }
  const object = plannerRecord(value, "PLANNER_JSON_INVALID");
  if (Object.keys(object).length > 10000) throw new TypeError("PLANNER_JSON_OBJECT_INVALID");
  return Object.fromEntries(Object.entries(object).map(([key, item]) => [key, parsePlannerJson(item, depth + 1)]));
}

export function parsePlannerJsonObject(value: unknown): PlannerJsonObject {
  plannerRecord(value);
  return parsePlannerJson(value) as PlannerJsonObject;
}

export function canonicalPlannerJson(value: unknown): string {
  const render = (json: PlannerJson): string => {
    if (json === null || typeof json !== "object") return JSON.stringify(json);
    if (Array.isArray(json)) return `[${json.map(render).join(",")}]`;
    const object = json as PlannerJsonObject;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${render(object[key])}`).join(",")}}`;
  };
  return render(parsePlannerJson(value));
}

export const plannerDigest = (value: unknown): string => bytesToHex(sha256(utf8ToBytes(canonicalPlannerJson(value))));
