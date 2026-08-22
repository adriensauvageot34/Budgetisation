import type { Brand } from "../../core/identity";

export type QueryResourceKey<Name extends string = string> = Brand<
  Name,
  "QueryResourceKey"
>;

const queryResourceKeyPattern = /^[a-z][a-z0-9_]*$/;

export function parseQueryResourceKeySyntax<Name extends string = string>(
  value: unknown,
): QueryResourceKey<Name> {
  if (typeof value !== "string" || !queryResourceKeyPattern.test(value)) {
    throw new TypeError(
      "QueryResourceKey doit respecter le format lower_snake_case ASCII.",
    );
  }
  return value as QueryResourceKey<Name>;
}
