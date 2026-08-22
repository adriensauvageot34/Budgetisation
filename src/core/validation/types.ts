export interface ValidationIssue {
  path: readonly (string | number)[];
  code: string;
  message: string;
}

export type ValidationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      issues: readonly ValidationIssue[];
    };

export interface RuntimeSchema<T> {
  safeParse(input: unknown): ValidationResult<T>;
  parse(input: unknown): T;
}
