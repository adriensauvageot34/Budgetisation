import { QueryTemporaryUnavailableError } from "@/query-api/server";

export type CanonicalHealthSourceName =
  | "economic"
  | "timing"
  | "places"
  | "person_days"
  | "life_events"
  | "purchase_events"
  | "financial_links"
  | "operations"
  | "entities";

export type CanonicalSourceName =
  | CanonicalHealthSourceName
  | "household_scope";

export class CanonicalReadError extends QueryTemporaryUnavailableError {
  readonly source: CanonicalSourceName;

  constructor(
    source: CanonicalSourceName,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message);
    if (options?.cause !== undefined) this.cause = options.cause;
    this.name = "CanonicalReadError";
    this.source = source;
  }
}

export class CanonicalConfigurationError extends CanonicalReadError {
  constructor(message: string) {
    super("operations", message);
    this.name = "CanonicalConfigurationError";
  }
}

export class CanonicalMissingMigrationError extends CanonicalReadError {
  constructor(source: Extract<CanonicalSourceName, "purchase_events">) {
    super(source, `La source canonique ${source} exige une migration non appliquée.`);
    this.name = "CanonicalMissingMigrationError";
  }
}
