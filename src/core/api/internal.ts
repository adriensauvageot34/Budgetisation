export function requireBoundaryString(
  value: unknown,
  fieldName: string,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${fieldName} doit être une chaîne non vide.`);
  }
  return value;
}
