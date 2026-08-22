import { parseStringLiteral } from "../validation";

export type Availability =
  | "known"
  | "unknown"
  | "not_applicable"
  | "conflict";

const availabilityValues: ReadonlySet<string> = new Set<Availability>([
  "known",
  "unknown",
  "not_applicable",
  "conflict",
]);

export function parseAvailability(value: unknown): Availability {
  return parseStringLiteral<Availability>(
    value,
    availabilityValues,
    "Availability",
  );
}
