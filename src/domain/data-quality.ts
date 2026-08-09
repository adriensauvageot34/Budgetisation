import type { Operation } from "@/domain/budget";
import { isConsumptionExpense } from "@/domain/calculations";
import { getSpendingContext } from "@/domain/spending-context";

export type OperationIssueKind =
  | "resource_type"
  | "refund_link"
  | "category"
  | "spending_context"
  | "event";

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
    operation.spendingContext === "Événement" &&
    !operation.event?.trim()
  ) {
    issues.push({
      kind: "event",
      level: "correction",
      label: "Événement à renseigner",
    });
  } else if (
    isConsumptionExpense(operation) &&
    getSpendingContext(operation) === "À confirmer"
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

export function getDataQualityWorkflow(operations: Operation[]) {
  const rows = operations
    .map((operation) => ({ operation, issues: getOperationIssues(operation) }))
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

