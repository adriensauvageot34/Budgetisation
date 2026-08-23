import {
  parseGlobalWindow,
  parseYearMonth,
  type GlobalWindow,
  type YearMonth,
} from "../../core/time";
import type {
  NormalizedAnalysisFilters,
  NormalizedAnalysisScope,
} from "../../core/scope";
import { validationFailure } from "../../core/validation";
import { parseNormalizedAnalysisScope } from "../contracts/checkpoint";
import {
  analysisTransferCompatibilitySchema,
  navigationContextMemorySchema,
  type AnalysisTransferCompatibility,
  type NavigationContextMemory,
  type TransferDecision,
} from "../contracts/context-transfer";
import type { HistoryRootContext } from "../contracts/routes";

type TransferMatrix = {
  readonly subject: TransferDecision;
  readonly month: TransferDecision;
  readonly globalWindow: TransferDecision;
  readonly categoryIds: TransferDecision;
  readonly activityIds: TransferDecision;
  readonly merchantIds: TransferDecision;
  readonly placeIds: TransferDecision;
  readonly lifeScopeContext: TransferDecision;
  readonly dayContext: TransferDecision;
  readonly subview: TransferDecision;
  readonly scroll: TransferDecision;
};

export const analysisTransferMatrix: {
  readonly monthToGlobal: TransferMatrix;
  readonly globalToMonth: TransferMatrix;
} = {
  monthToGlobal: {
    subject: "preserve",
    month: "remember",
    globalWindow: "transform",
    categoryIds: "transform",
    activityIds: "transform",
    merchantIds: "drop",
    placeIds: "drop",
    lifeScopeContext: "drop",
    dayContext: "drop",
    subview: "drop",
    scroll: "remember",
  },
  globalToMonth: {
    subject: "preserve",
    month: "transform",
    globalWindow: "remember",
    categoryIds: "transform",
    activityIds: "transform",
    merchantIds: "drop",
    placeIds: "drop",
    lifeScopeContext: "drop",
    dayContext: "drop",
    subview: "drop",
    scroll: "remember",
  },
};

export type MonthToGlobalTransferInput = {
  readonly sourceScope: NormalizedAnalysisScope;
  readonly targetWindow: GlobalWindow;
  readonly asOf: YearMonth;
  readonly compatibility: AnalysisTransferCompatibility;
  readonly memory: NavigationContextMemory;
};

export type AnalysisTransferSuccess = {
  readonly kind: "success";
  readonly targetRoot: HistoryRootContext;
  readonly targetScope: NormalizedAnalysisScope;
  readonly memory: NavigationContextMemory;
};

export type GlobalToMonthTransferResult =
  | AnalysisTransferSuccess
  | {
      readonly kind: "missing_last_analysed_month";
      readonly memory: NavigationContextMemory;
    };

function transferFilters(
  source: NormalizedAnalysisFilters,
  compatibility: AnalysisTransferCompatibility,
): NormalizedAnalysisFilters {
  return {
    categoryIds: compatibility.categoryIds ? source.categoryIds : [],
    activityIds: compatibility.activityIds ? source.activityIds : [],
    merchantIds: [],
    placeIds: [],
    lifeScopeContext: [],
    dayContext: [],
  };
}

export function transferMonthToGlobal(
  input: MonthToGlobalTransferInput,
): AnalysisTransferSuccess {
  const source = parseNormalizedAnalysisScope(input.sourceScope);
  if (source.time.kind !== "month") {
    validationFailure({
      path: ["sourceScope", "time"],
      code: "invalid_source_context",
      message: "transferMonthToGlobal exige une source Analysis Month.",
    });
  }
  const targetWindow = parseGlobalWindow(input.targetWindow);
  const asOf = parseYearMonth(input.asOf);
  const compatibility = analysisTransferCompatibilitySchema.parse(
    input.compatibility,
  );
  const currentMemory = navigationContextMemorySchema.parse(input.memory);
  const targetScope: NormalizedAnalysisScope = {
    subject: source.subject,
    time: { kind: "global", observationWindow: targetWindow, asOf },
    filters: transferFilters(source.filters, compatibility),
  };
  const memory = navigationContextMemorySchema.parse({
    ...currentMemory,
    lastAnalysedMonth: source.time.month,
    lastGlobalWindow: targetWindow,
  });
  return {
    kind: "success",
    targetRoot: {
      area: "analysis",
      context: {
        kind: "analysis_global",
        observationWindow: targetWindow,
        asOf,
        ...(source.subject.kind === "person"
          ? { personId: source.subject.personId }
          : {}),
      },
    },
    targetScope,
    memory,
  };
}

export function transferGlobalToMonth(
  sourceScope: NormalizedAnalysisScope,
  compatibilityInput: AnalysisTransferCompatibility,
  memoryInput: NavigationContextMemory,
): GlobalToMonthTransferResult {
  const source = parseNormalizedAnalysisScope(sourceScope);
  if (source.time.kind !== "global") {
    validationFailure({
      path: ["sourceScope", "time"],
      code: "invalid_source_context",
      message: "transferGlobalToMonth exige une source Analysis Global.",
    });
  }
  const compatibility = analysisTransferCompatibilitySchema.parse(
    compatibilityInput,
  );
  const currentMemory = navigationContextMemorySchema.parse(memoryInput);
  const memory = navigationContextMemorySchema.parse({
    ...currentMemory,
    lastGlobalWindow: source.time.observationWindow,
  });
  if (memory.lastAnalysedMonth === undefined) {
    return { kind: "missing_last_analysed_month", memory };
  }
  const month = memory.lastAnalysedMonth;
  return {
    kind: "success",
    targetRoot: {
      area: "analysis",
      context: {
        kind: "analysis_month",
        month,
        ...(source.subject.kind === "person"
          ? { personId: source.subject.personId }
          : {}),
      },
    },
    targetScope: {
      subject: source.subject,
      time: { kind: "month", month },
      filters: transferFilters(source.filters, compatibility),
    },
    memory,
  };
}
