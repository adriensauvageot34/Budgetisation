import type { Operation, OperationAllocation } from "@/domain/budget";
import { isConsumptionExpense } from "@/domain/calculations";
import { getEffectiveLifeContext } from "@/domain/life-analysis";
import { buildAnalyticalEntries } from "@/domain/analytical-entries";

export type OperationIssueKind =
  | "resource_type"
  | "refund_link"
  | "category"
  | "spending_context"
  | "event"
  | "allocation";

export type OperationIssue = {
  kind: OperationIssueKind;
  level: "correction" | "enrichment";
  label: string;
};

export function getOperationIssues(operation: Operation): OperationIssue[] {
  const issues: OperationIssue[] = [];

  if (operation.resourceType === "À qualifier") {
    issues.push({
      kind: "resource_type",
      level: "correction",
      label: "Type d’entrée d’argent à qualifier",
    });
  }
  if (
    operation.resourceType === "Remboursement" &&
    !operation.reimbursesOperationId
  ) {
    issues.push({
      kind: "refund_link",
      level: "correction",
      label: "Remboursement à rattacher",
    });
  }
  if (
    isConsumptionExpense(operation) &&
    (!operation.category || operation.category === "Non renseigné")
  ) {
    issues.push({
      kind: "category",
      level: "correction",
      label: "Famille de dépense manquante",
    });
  }
  if (
    isConsumptionExpense(operation) &&
    getEffectiveLifeContext(operation) === "À confirmer"
  ) {
    issues.push({
      kind: "spending_context",
      level: "enrichment",
      label: "Contexte analytique à préciser",
    });
  }

  return issues;
}

const maximumEnrichmentsInWorkflow = 20;

export function isRentExpense(operation: Operation) {
  return [
    operation.category,
    operation.subcategory,
    operation.preciseType,
    operation.normalizedMerchant,
    operation.sourceLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .includes("loyer");
}

export function getDataQualityWorkflow(
  operations: Operation[],
  allocations: OperationAllocation[] = [],
) {
  const problems = new Map(
    buildAnalyticalEntries(operations, [], allocations).allocationProblems.map((problem) => [problem.operationId, problem]),
  );
  const rows = operations
    .map((operation) => {
      const issues = getOperationIssues(operation);
      const problem = problems.get(operation.id);
      if (problem) issues.push({
        kind: "allocation",
        level: "correction",
        label: `Ventilation incohérente : ${problem.allocated.toFixed(2)} € ventilés pour ${problem.available.toFixed(2)} € disponibles`,
      });
      return { operation, issues };
    })
    .filter((entry) => entry.issues.length)
    .sort((a, b) => b.operation.date.localeCompare(a.operation.date));
  const corrections = rows.filter((entry) =>
    entry.issues.some((issue) => issue.level === "correction"),
  );
  const enrichments = rows
    .filter((entry) =>
      entry.issues.every((issue) => issue.level === "enrichment"),
    )
    .slice(0, maximumEnrichmentsInWorkflow);
  return [...corrections, ...enrichments];
}

export function getDataQualityCounts(operations: Operation[], allocations: OperationAllocation[] = []) {
  const workflow = getDataQualityWorkflow(operations, allocations);
  return {
    workflow,
    correctionCount: workflow.filter((entry) => entry.issues.some((issue) => issue.level === "correction")).length,
    enrichmentCount: workflow.filter((entry) => entry.issues.every((issue) => issue.level === "enrichment")).length,
  };
}

