import {
  createRuntimeSchema,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  withValidationPath,
} from "../../core/validation";
import { parseActivityId, parsePersonId, type ActivityId, type PersonId } from "../../core/identity";
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
        | "typical"
        | "evolution"
        | "habits"
        | "profiles"
        | "universe";
      readonly baselineView?: "day" | "week" | "month";
      readonly evolutionView?: "money" | "behavior";
      readonly selectedMonth?: YearMonth;
      readonly habitsView?: "contexts" | "heatmap";
      readonly profileTarget?: { readonly kind: "ensemble" } | { readonly kind: "person"; readonly personId: PersonId };
      readonly selectedHeatmapCell?: { readonly activityId: ActivityId; readonly month: YearMonth };
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
  "typical",
  "evolution",
  "habits",
  "profiles",
  "universe",
]);

export function parseNavigationSubviewRef(
  value: unknown,
): NavigationSubviewRef {
  const record = parseStrictRecord(
    value,
    ["kind", "view", "selectedPoint", "structure", "lived", "baselineView", "evolutionView", "selectedMonth", "habitsView", "profileTarget", "selectedHeatmapCell"],
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
  const globalRecord = parseStrictRecord(value, ["kind", "view", "baselineView", "evolutionView", "selectedMonth", "habitsView", "profileTarget", "selectedHeatmapCell"], "AnalysisGlobalSubviewRef");
  const profileTarget = "profileTarget" in globalRecord
    ? (() => {
        const target = parseStrictRecord(globalRecord.profileTarget, ["kind", "personId"], "GlobalProfileTarget");
        if (target.kind === "ensemble") return { kind: "ensemble" as const };
        if (target.kind !== "person") throw new TypeError("GlobalProfileTarget.kind est invalide.");
        return { kind: "person" as const, personId: parsePersonId(requireProperty(target, "personId", "GlobalProfileTarget")) };
      })()
    : undefined;
  const selectedHeatmapCell = "selectedHeatmapCell" in globalRecord
    ? (() => { const cell = parseStrictRecord(globalRecord.selectedHeatmapCell, ["activityId", "month"], "SelectedHeatmapCell"); return { activityId: parseActivityId(requireProperty(cell, "activityId", "SelectedHeatmapCell")), month: parseYearMonth(requireProperty(cell, "month", "SelectedHeatmapCell")) }; })()
    : undefined;
  return {
    kind,
    view: withValidationPath("view", () =>
      parseStringLiteral<
        "overview" | "baseline" | "typical" | "evolution" | "habits" | "profiles" | "universe"
      >(
        requireProperty(globalRecord, "view", "NavigationSubviewRef"),
        analysisGlobalViews,
        "NavigationSubviewRef.view",
      ),
    ),
    ...(globalRecord.baselineView === undefined ? {} : { baselineView: parseStringLiteral<"day" | "week" | "month">(globalRecord.baselineView, new Set(["day", "week", "month"]), "Global baseline view") }),
    ...(globalRecord.evolutionView === undefined ? {} : { evolutionView: parseStringLiteral<"money" | "behavior">(globalRecord.evolutionView, new Set(["money", "behavior"]), "Global evolution view") }),
    ...(globalRecord.selectedMonth === undefined ? {} : { selectedMonth: parseYearMonth(globalRecord.selectedMonth) }),
    ...(globalRecord.habitsView === undefined ? {} : { habitsView: parseStringLiteral<"contexts" | "heatmap">(globalRecord.habitsView, new Set(["contexts", "heatmap"]), "Global habits view") }),
    ...(profileTarget === undefined ? {} : { profileTarget }),
    ...(selectedHeatmapCell === undefined ? {} : { selectedHeatmapCell }),
  };
}

export const navigationSubviewRefSchema = createRuntimeSchema(
  parseNavigationSubviewRef,
);
