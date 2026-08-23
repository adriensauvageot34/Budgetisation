import {
  createRuntimeSchema,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  withValidationPath,
} from "../../core/validation";
import { parseActivityId, type ActivityId } from "../../core/identity";
import { parseYearMonth, type YearMonth } from "../../core/time";

export type AnalysisMonthStructureSubview = {
  readonly view: "destination" | "nature" | "life_context";
  readonly dimension: "family" | "category" | "activity" | "merchant" | "place" | "fixed_variable" | "life_context" | "necessity";
  readonly measure: "amount" | "share" | "occurrences" | "cost_per_occurrence";
  readonly selectedBucketId?: string;
};

export type AnalysisMonthLivedSubview = {
  readonly activeSubview: "summary" | "rhythm" | "contexts" | "frequency_cost";
  readonly selectedActivityId?: ActivityId;
};

export type NavigationSubviewRef =
  | {
      readonly kind: "analysis-month";
      readonly view: "summary" | "money" | "life" | "moments";
      readonly selectedPoint?: YearMonth;
      readonly structure?: AnalysisMonthStructureSubview;
      readonly lived?: AnalysisMonthLivedSubview;
    }
  | {
      readonly kind: "analysis-global";
      readonly view:
        | "overview"
        | "baseline"
        | "habits"
        | "profiles"
        | "universe";
    };

const subviewKinds = new Set<NavigationSubviewRef["kind"]>([
  "analysis-month",
  "analysis-global",
]);
const analysisMonthViews = new Set([
  "summary",
  "money",
  "life",
  "moments",
]);
const analysisGlobalViews = new Set([
  "overview",
  "baseline",
  "habits",
  "profiles",
  "universe",
]);

export function parseNavigationSubviewRef(
  value: unknown,
): NavigationSubviewRef {
  const record = parseStrictRecord(
    value,
    ["kind", "view", "selectedPoint", "structure", "lived"],
    "NavigationSubviewRef",
  );
  const kind = withValidationPath("kind", () =>
    parseStringLiteral<NavigationSubviewRef["kind"]>(
      requireProperty(record, "kind", "NavigationSubviewRef"),
      subviewKinds,
      "NavigationSubviewRef.kind",
    ),
  );

  if (kind === "analysis-month") {
    const monthRecord = parseStrictRecord(
      value,
      ["kind", "view", "selectedPoint", "structure", "lived"],
      "AnalysisMonthSubviewRef",
    );
    const structure = "structure" in monthRecord
      ? (() => {
          const record = parseStrictRecord(monthRecord.structure, ["view", "dimension", "measure", "selectedBucketId"], "AnalysisMonthStructureSubview");
          const selectedBucketId = "selectedBucketId" in record
            ? (() => { if (typeof record.selectedBucketId !== "string" || record.selectedBucketId.trim().length === 0) throw new TypeError("selectedBucketId invalide."); return record.selectedBucketId; })()
            : undefined;
          return {
            view: parseStringLiteral(requireProperty(record, "view", "AnalysisMonthStructureSubview"), new Set(["destination", "nature", "life_context"]), "Structure subview view"),
            dimension: parseStringLiteral(requireProperty(record, "dimension", "AnalysisMonthStructureSubview"), new Set(["family", "category", "activity", "merchant", "place", "fixed_variable", "life_context", "necessity"]), "Structure subview dimension"),
            measure: parseStringLiteral(requireProperty(record, "measure", "AnalysisMonthStructureSubview"), new Set(["amount", "share", "occurrences", "cost_per_occurrence"]), "Structure subview measure"),
            ...(selectedBucketId === undefined ? {} : { selectedBucketId }),
          } as AnalysisMonthStructureSubview;
        })()
      : undefined;
    const lived = "lived" in monthRecord
      ? (() => {
          const record = parseStrictRecord(monthRecord.lived, ["activeSubview", "selectedActivityId"], "AnalysisMonthLivedSubview");
          return {
            activeSubview: parseStringLiteral(requireProperty(record, "activeSubview", "AnalysisMonthLivedSubview"), new Set(["summary", "rhythm", "contexts", "frequency_cost"]), "Lived activeSubview"),
            ...("selectedActivityId" in record ? { selectedActivityId: parseActivityId(record.selectedActivityId) } : {}),
          } as AnalysisMonthLivedSubview;
        })()
      : undefined;
    return {
      kind,
      view: withValidationPath("view", () =>
        parseStringLiteral<"summary" | "money" | "life" | "moments">(
          requireProperty(record, "view", "NavigationSubviewRef"),
          analysisMonthViews,
          "NavigationSubviewRef.view",
        ),
      ),
      ...("selectedPoint" in monthRecord ? { selectedPoint: parseYearMonth(monthRecord.selectedPoint) } : {}),
      ...(structure === undefined ? {} : { structure }),
      ...(lived === undefined ? {} : { lived }),
    };
  }
  const globalRecord = parseStrictRecord(value, ["kind", "view"], "AnalysisGlobalSubviewRef");
  return {
    kind,
    view: withValidationPath("view", () =>
      parseStringLiteral<
        "overview" | "baseline" | "habits" | "profiles" | "universe"
      >(
        requireProperty(globalRecord, "view", "NavigationSubviewRef"),
        analysisGlobalViews,
        "NavigationSubviewRef.view",
      ),
    ),
  };
}

export const navigationSubviewRefSchema = createRuntimeSchema(
  parseNavigationSubviewRef,
);
