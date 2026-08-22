import { parseStringLiteral } from "../validation";

export type Provenance = "observed" | "derived" | "estimated";

const provenanceValues: ReadonlySet<string> = new Set<Provenance>([
  "observed",
  "derived",
  "estimated",
]);

export function parseProvenance(value: unknown): Provenance {
  return parseStringLiteral<Provenance>(
    value,
    provenanceValues,
    "Provenance",
  );
}
