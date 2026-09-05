import type { GlobalCapability } from "./types";
import { parseGlobalCapability } from "./validation";

export type GlobalAuthorityGateId =
  | "AG001" | "AG002" | "AG003" | "AG004" | "AG005"
  | "AG006" | "AG007" | "AG008" | "AG009" | "AG010"
  | "AG011" | "AG012" | "AG013" | "AG014" | "AG015"
  | "AG016" | "AG017" | "AG018" | "AG019" | "AG020"
  | "AG021" | "AG022" | "AG023" | "AG024" | "AG025"
  | "AG026" | "AG027" | "AG028" | "AG029" | "AG030"
  | "AG031";

export type GlobalAuthorityGate = {
  readonly gateId: GlobalAuthorityGateId;
  readonly masterGateId: `AG-${string}`;
  readonly state: "UNAVAILABLE";
  readonly reasonCode: "AUTHORITY_NOT_PROVEN_GA0";
  readonly evidenceRef: "docs/global-v2/GA0-post-history-reality-check.md";
};

const gateNumbers = Array.from({ length: 31 }, (_, index) => index + 1);

export const globalAuthorityGates = Object.freeze(Object.fromEntries(
  gateNumbers.map((number) => {
    const suffix = number.toString().padStart(3, "0");
    const gateId = `AG${suffix}` as GlobalAuthorityGateId;
    return [gateId, Object.freeze({
      gateId,
      masterGateId: `AG-${suffix}` as `AG-${string}`,
      state: "UNAVAILABLE" as const,
      reasonCode: "AUTHORITY_NOT_PROVEN_GA0" as const,
      evidenceRef: "docs/global-v2/GA0-post-history-reality-check.md" as const,
    })];
  }),
)) as Readonly<Record<GlobalAuthorityGateId, GlobalAuthorityGate>>;

export function parseGlobalAuthorityGateId(value: unknown): GlobalAuthorityGateId {
  if (typeof value !== "string" || !Object.hasOwn(globalAuthorityGates, value)) {
    throw new TypeError("GlobalAuthorityGateId doit référencer AG001 à AG031.");
  }
  return value as GlobalAuthorityGateId;
}

export function assertCapabilityRespectsAuthorityGates(
  value: unknown,
): GlobalCapability {
  const capability = parseGlobalCapability(value);
  const gates = capability.authorityGateIds.map(parseGlobalAuthorityGateId);
  if (
    gates.length > 0
    && capability.state === "AVAILABLE"
  ) {
    throw new TypeError("Une authority gate fermée ne peut pas produire une capability AVAILABLE.");
  }
  if (
    gates.length > 0
    && capability.state === "UNAVAILABLE"
    && !capability.reasonCodes.includes("AUTHORITY_NOT_PROVEN_GA0")
  ) {
    throw new TypeError("Une capability fermée par GA0 doit publier sa raison machine.");
  }
  return capability;
}
