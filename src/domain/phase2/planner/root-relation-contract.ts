import type { PlanSemanticStateV1 } from "./semantic-state";

/** Local N1 slice. V1 financial/Draft transports deliberately do not accept it. */
export const ROOT_RELATION_PLAN_VERSION = "month-plan-state@v2-root-relations" as const;
export const ROOT_RELATION_VERSION = "root-context-relation@v1" as const;
export const ROOT_RELATION_CAPABILITIES_VERSION = "root-relation-capabilities@v1" as const;
/** Pilot matrix, not permission to group every Context or promote children. */
export const ROOT_RELATION_PRESETS: readonly string[] = ["friends-evening", "bar-apero"];

export type RootContextRelationV1 = Readonly<{
  version: typeof ROOT_RELATION_VERSION;
  relationId: string;
  targetMonth: string;
  orderedContextIds: readonly string[];
  provenance: "EXPLICIT_USER_DECISION";
}>;
export type RootRelationPlanState = Omit<PlanSemanticStateV1, "version"> & Readonly<{
  version: typeof ROOT_RELATION_PLAN_VERSION;
  rootRelations: readonly RootContextRelationV1[];
}>;

export type RootRelationMutation =
  | Readonly<{ kind: "CREATE_ROOT_RELATION"; relationId: string; orderedContextIds: readonly string[] }>
  | Readonly<{ kind: "ADD_ROOT_RELATION_MEMBER"; relationId: string; contextOccurrenceId: string }>
  | Readonly<{ kind: "REORDER_ROOT_RELATION"; relationId: string; orderedContextIds: readonly string[] }>
  | Readonly<{ kind: "DETACH_ROOT_RELATION_MEMBER"; relationId: string; contextOccurrenceId: string }>
  | Readonly<{ kind: "REMOVE_ROOT_RELATION"; relationId: string }>;
export type RootRelationAction = RootRelationMutation["kind"];
export type RootRelationCommand = Readonly<{
  targetMonth: string;
  expectedStateDigest: string;
  mutation: RootRelationMutation;
}>;

export type RootRelationErrorCode =
  | "N1_STATE_VERSION_UNSUPPORTED" | "N1_RELATION_VERSION_UNSUPPORTED" | "N1_RELATIONS_INVALID"
  | "N1_RELATION_ID_DUPLICATE" | "N1_RELATION_ID_COLLIDES_WITH_CONTEXT" | "N1_RELATION_NOT_FOUND"
  | "N1_MEMBERS_INVALID" | "N1_MEMBER_DUPLICATE" | "N1_MEMBER_NOT_FOUND" | "N1_MEMBER_IS_CHILD"
  | "N1_MEMBER_NOT_ADMITTED" | "N1_MEMBER_ALREADY_LINKED" | "N1_MEMBER_NOT_IN_RELATION"
  | "N1_SCOPE_MISMATCH" | "N1_PROVENANCE_INVALID" | "N1_ORDER_INVALID" | "N1_PERMISSION_DENIED"
  | "N1_MEMBER_PERMISSION_DENIED" | "N1_MEMBER_PRESERVED" | "N1_MEMBER_IDENTITY_CHANGED" | "N1_AUTHORITY_STALE"
  | "N1_STATE_STALE" | "N1_OPERATION_UNSUPPORTED" | "N1_NO_ELIGIBLE_MEMBERS";
export class RootRelationError extends TypeError {
  constructor(readonly code: RootRelationErrorCode) { super(code); this.name = "RootRelationError"; }
}
export type RootRelationCapability = Readonly<{
  action: RootRelationAction;
  relationId: string | null;
  status: "AVAILABLE" | "BLOCKED";
  reason: RootRelationErrorCode | null;
  eligibleContextIds: readonly string[];
}>;
export type RootRelationCapabilities = Readonly<{
  version: typeof ROOT_RELATION_CAPABILITIES_VERSION;
  targetMonth: string;
  stateDigest: string;
  capabilities: readonly RootRelationCapability[];
}>;
