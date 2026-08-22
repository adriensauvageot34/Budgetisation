import {
  RuntimeValidationError,
  validationIssuesFrom,
} from "./errors";
import type { RuntimeSchema } from "./types";

export type RuntimeParser<T> = (input: unknown) => T;

export function createRuntimeSchema<T>(
  parser: RuntimeParser<T>,
): RuntimeSchema<T> {
  const safeParse: RuntimeSchema<T>["safeParse"] = (input) => {
    try {
      return { success: true, data: parser(input) };
    } catch (error) {
      return { success: false, issues: validationIssuesFrom(error) };
    }
  };

  return {
    safeParse,
    parse(input) {
      const result = safeParse(input);
      if (result.success) return result.data;
      throw new RuntimeValidationError(result.issues);
    },
  };
}
