import {
  analysisScopeSchema,
  type AnalysisScope,
} from "../scope";
import type { ValidationIssue } from "../validation";
import {
  createInvalidScopeApiError,
  INVALID_SCOPE_MESSAGE,
} from "./errors";
import { requireBoundaryString } from "./internal";
import type { ApiError } from "./types";

export class InvalidScopeValidationError extends Error {
  readonly code = "INVALID_SCOPE" as const;
  readonly requestId: string;
  readonly issues: readonly ValidationIssue[];

  constructor(requestId: string, issues: readonly ValidationIssue[]) {
    super(INVALID_SCOPE_MESSAGE);
    this.name = "InvalidScopeValidationError";
    this.requestId = requestId;
    this.issues = issues.map((issue) => ({ ...issue, path: [...issue.path] }));
  }

  toApiError(): ApiError {
    return createInvalidScopeApiError(this.requestId);
  }
}

export function parseScopeInput(
  input: unknown,
  context: { requestId: string },
): AnalysisScope {
  const requestId = requireBoundaryString(context.requestId, "requestId");
  const result = analysisScopeSchema.safeParse(input);
  if (result.success) return result.data;
  throw new InvalidScopeValidationError(requestId, result.issues);
}
