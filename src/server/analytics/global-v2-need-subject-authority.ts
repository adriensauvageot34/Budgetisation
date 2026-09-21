import "server-only";

import type { GlobalM2NeedSubjectAuthority } from "@/analytics/global-v2";
import { parsePersonId, type PersonId } from "@/core/identity";
import { optionalCanonicalString, type CanonicalRecord } from "@/server/canonical/record";

/** Resolves a Need subject exclusively from Canonical needs.person_id. */
export function resolveGlobalM2NeedSubjects(
  rows: readonly CanonicalRecord[],
  authorizedPersonIds: readonly PersonId[],
): Readonly<Record<string, GlobalM2NeedSubjectAuthority>> {
  const authorized = new Set(authorizedPersonIds.map(String));
  const resolved = new Map<string, GlobalM2NeedSubjectAuthority>();
  for (const row of [...rows].sort((left, right) => (optionalCanonicalString(left, ["need_id"]) ?? "").localeCompare(optionalCanonicalString(right, ["need_id"]) ?? ""))) {
    const needId = optionalCanonicalString(row, ["need_id"]);
    if (needId === undefined) continue;
    const rawPersonId = row.person_id;
    let subject: GlobalM2NeedSubjectAuthority;
    if (rawPersonId === undefined || rawPersonId === null || rawPersonId === "") {
      subject = { scope: "HOUSEHOLD" };
    } else {
      try {
        const personId = parsePersonId(rawPersonId);
        subject = authorized.has(String(personId)) ? { scope: "PERSONAL", personId } : { scope: "CONFLICT" };
      } catch {
        subject = { scope: "CONFLICT" };
      }
    }
    const previous = resolved.get(needId);
    resolved.set(needId, previous === undefined || JSON.stringify(previous) === JSON.stringify(subject) ? subject : { scope: "CONFLICT" });
  }
  return Object.fromEntries([...resolved.entries()].sort(([left], [right]) => left.localeCompare(right)));
}
