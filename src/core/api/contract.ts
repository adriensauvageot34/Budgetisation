import type {
  RuntimeSchema,
  ValidationIssue,
} from "../validation";
import {
  createContractMismatchApiError,
  CONTRACT_MISMATCH_MESSAGE,
} from "./errors";
import { requireBoundaryString } from "./internal";
import type { ApiError } from "./types";

export type ParseContractContext = {
  contractName: string;
  requestId: string;
};

export class ContractValidationError extends Error {
  readonly code = "CONTRACT_MISMATCH" as const;
  readonly contractName: string;
  readonly requestId: string;
  readonly issues: readonly ValidationIssue[];

  constructor(
    contractName: string,
    requestId: string,
    issues: readonly ValidationIssue[],
  ) {
    super(CONTRACT_MISMATCH_MESSAGE);
    this.name = "ContractValidationError";
    this.contractName = contractName;
    this.requestId = requestId;
    this.issues = issues.map((issue) => ({ ...issue, path: [...issue.path] }));
  }

  toApiError(): ApiError {
    return createContractMismatchApiError(this.requestId);
  }
}

export function parseContract<T>(
  schema: RuntimeSchema<T>,
  input: unknown,
  context: ParseContractContext,
): T {
  const contractName = requireBoundaryString(
    context.contractName,
    "contractName",
  );
  const requestId = requireBoundaryString(context.requestId, "requestId");
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new ContractValidationError(contractName, requestId, result.issues);
}
