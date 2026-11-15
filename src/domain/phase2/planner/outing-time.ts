export function parseOutingTime(value: unknown): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(value))
    throw new TypeError("COMPOSER_OUTING_TIME_INVALID");
  return value;
}
