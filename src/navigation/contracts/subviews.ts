import {
  createRuntimeSchema,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
  withValidationPath,
} from "../../core/validation";

export type NavigationSubviewRef =
  | {
      readonly kind: "analysis-month";
      readonly view: "summary" | "money" | "life" | "moments";
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
    ["kind", "view"],
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
    return {
      kind,
      view: withValidationPath("view", () =>
        parseStringLiteral<"summary" | "money" | "life" | "moments">(
          requireProperty(record, "view", "NavigationSubviewRef"),
          analysisMonthViews,
          "NavigationSubviewRef.view",
        ),
      ),
    };
  }
  return {
    kind,
    view: withValidationPath("view", () =>
      parseStringLiteral<
        "overview" | "baseline" | "habits" | "profiles" | "universe"
      >(
        requireProperty(record, "view", "NavigationSubviewRef"),
        analysisGlobalViews,
        "NavigationSubviewRef.view",
      ),
    ),
  };
}

export const navigationSubviewRefSchema = createRuntimeSchema(
  parseNavigationSubviewRef,
);
