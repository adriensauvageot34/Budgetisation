import "server-only";

export type CanonicalQueryErrorShape = {
  readonly code?: string;
  readonly message?: string;
};

export function isMissingPurchaseRelationError(
  error: CanonicalQueryErrorShape,
): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = error.message ?? "";
  return (
    /\brelation\b.{0,180}\bdoes not exist\b/i.test(message) ||
    /\bcould not find the table\b.{0,180}\bin the schema cache\b/i.test(message)
  );
}
