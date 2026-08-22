import type { ValidationIssue } from "./types";

export class RuntimeValidationError extends TypeError {
  readonly issues: readonly ValidationIssue[];

  constructor(
    issues: readonly ValidationIssue[],
    message = "Le payload ne respecte pas le contrat attendu.",
  ) {
    super(message);
    this.name = "RuntimeValidationError";
    this.issues = issues.map((issue) => ({
      path: [...issue.path],
      code: issue.code,
      message: issue.message,
    }));
  }
}

export function validationFailure(issue: ValidationIssue): never {
  throw new RuntimeValidationError([issue], issue.message);
}

export function validationIssuesFrom(error: unknown): readonly ValidationIssue[] {
  if (error instanceof RuntimeValidationError) return error.issues;
  return [
    {
      path: [],
      code: "invalid_value",
      message:
        error instanceof Error
          ? error.message
          : "La valeur ne respecte pas le contrat attendu.",
    },
  ];
}

export function withValidationPath<T>(
  segment: string | number,
  operation: () => T,
): T {
  try {
    return operation();
  } catch (error) {
    throw new RuntimeValidationError(
      validationIssuesFrom(error).map((issue) => ({
        ...issue,
        path: [segment, ...issue.path],
      })),
    );
  }
}
