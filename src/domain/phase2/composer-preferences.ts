import { plannerKeys, plannerRecord, plannerString, plannerUuid } from "./planner/json";

export type ExplicitPreference = Readonly<{ subjectKey: string; scope: string; label: string; scopeLabel: string;
  stance: "LIKE" | "DISMISS"; reviewOn: string | null; version: number }>;
export type PersonalRecommendationScope = Readonly<{ rows: readonly ExplicitPreference[]; contextId?: string; search?: boolean; today?: string }>;
export const preferenceDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export function preferenceSubject(raw: unknown) {
  if (typeof raw !== "string" || raw.length > 140 || !/^(v22-art:[a-z0-9:-]+|preset:[a-z0-9-]+)$/u.test(raw)) throw new TypeError("PREFERENCE_INVALID");
  return raw;
}
export function preferenceScope(raw: unknown) { return raw === "GLOBAL" ? raw : plannerUuid(raw); }
export function preferenceDate(raw: unknown): string | null {
  if (raw === null) return null;
  if (typeof raw !== "string" || !/^20\d\d-\d\d-\d\d$/u.test(raw) || !Number.isFinite(Date.parse(raw))
    || new Date(raw).toISOString().slice(0, 10) !== raw) throw new TypeError("PREFERENCE_INVALID");
  return raw;
}
export function parsePreference(raw: unknown): ExplicitPreference {
  const v = plannerRecord(raw);
  plannerKeys(v, ["subjectKey", "scope", "label", "scopeLabel", "stance", "reviewOn", "version"]);
  const label = plannerString(v.label).trim(), scopeLabel = plannerString(v.scopeLabel).trim();
  if (label.length > 120 || scopeLabel.length > 120 || !["LIKE", "DISMISS"].includes(String(v.stance))
    || !Number.isSafeInteger(v.version) || Number(v.version) < 0) throw new TypeError("PREFERENCE_INVALID");
  return { subjectKey: preferenceSubject(v.subjectKey), scope: preferenceScope(v.scope), label, scopeLabel,
    stance: v.stance as ExplicitPreference["stance"], reviewOn: preferenceDate(v.reviewOn), version: Number(v.version) };
}
/** Explicit choices only. No inferred purchase, stock, person mapping or financial action. */
export function preferenceEffect(key: string | undefined, scope?: PersonalRecommendationScope) {
  const row = key && (scope?.rows.find(r => r.subjectKey === key && r.scope === scope.contextId)
    ?? scope?.rows.find(r => r.subjectKey === key && r.scope === "GLOBAL"));
  if (!row) return { tier: 1, hidden: false, reason: "" };
  if (row.stance === "DISMISS") return { tier: 2, hidden: !scope?.search,
    reason: row.scope === "GLOBAL" ? "Moins dans mes idées · reste recherchable" : "Moins dans ce projet · reste recherchable" };
  if (row.reviewOn) {
    const later = row.reviewOn > (scope?.today ?? preferenceDay());
    return { tier: later ? 2 : 0, hidden: later && !scope?.search,
      reason: later ? `Réexamen choisi à partir du ${row.reviewOn}` : "Date de réexamen choisie atteinte · aucun achat déduit" };
  }
  return { tier: 0, hidden: false, reason: "Votre intérêt explicite" };
}
