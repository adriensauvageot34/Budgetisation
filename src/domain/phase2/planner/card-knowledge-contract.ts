/** Read-only, request-local projection of existing owner publications. Never a Plan decision. */
export type CardKnowledgeDimension = Readonly<{
  key: "MONTH_AMOUNT" | "OCCURRENCE_COUNT" | "UNIT_PRICE" | "FORECAST_MONTH";
  value: string | null;
  unit: "EUR_PER_MONTH" | "OCCURRENCES_PER_MONTH" | "EUR_PER_OCCURRENCE" | "EUR_PER_PRODUCT";
  p25: string | null; p50: string | null; p75: string | null;
  evidenceState: "DECLARED" | "KNOWN" | "ESTIMATED" | "PARTIAL" | "UNKNOWN";
  sourceAuthority: string;
  sourceRefs: readonly string[];
  sourceDigests: readonly string[];
  nOccurrences: number | null;
  nCoveredMonths: number | null;
  coverageFrom: string | null;
  coverageTo: string | null;
  observedAt: string | null;
  suggestionPolicy: "OFFER_PREFILL" | "REFERENCE_ONLY" | "UNAVAILABLE";
  reasonCodes: readonly string[];
}>;
export type CardKnowledgeRead = Readonly<{
  cardKey: string;
  subjectScope: "HOUSEHOLD" | "PERSON" | "EVENT" | "PRODUCT" | "ROUTE";
  subjectRef: string | null;
  dimensions: readonly CardKnowledgeDimension[];
  knowledgeVersion: "composer-card-knowledge@v1";
}>;
