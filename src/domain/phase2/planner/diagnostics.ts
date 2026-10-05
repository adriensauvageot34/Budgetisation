import type { PlannerJson } from "./json";

export type PlannerKnowledge = "KNOWN" | "DECLARED" | "ESTIMATED" | "PARTIAL" | "UNKNOWN" | "NOT_APPLICABLE";
export type PlannerConfidence = "HIGH" | "MEDIUM" | "LOW" | "NOT_APPLICABLE";
export type PlannerProvenance = "CANONICAL_FACT" | "CANONICAL_HISTORY" | "USER_VALIDATED_HABIT"
  | "STRUCTURAL_DEFAULT" | "PERSONAL_SUGGESTION" | "SYSTEM_PRESET" | "EXPLICIT_USER_DECISION" | "DERIVED_CONSEQUENCE";
export type PlannerDiagnostic = Readonly<{ code: string; severity: "BLOCK" | "WARN" | "INFO";
  targetRef: string | null; message: string; evidenceRefs: readonly string[] }>;
export type ConstraintResult = Readonly<{ severity: "BLOCK" | "WARN" | "INFO" | "PASS"; code: string;
  scope: string; targetRef: string | null; candidate: PlannerJson; reference: PlannerJson;
  evidenceRefs: readonly string[]; confidence: PlannerConfidence; remediation: PlannerJson; policyVersion: string }>;
export type PlannerTemporalRef = Readonly<{ kind: "DATED"; date: string; time: string | null }
  | { kind: "MONTH_UNSCHEDULED"; targetMonth: string }>;
