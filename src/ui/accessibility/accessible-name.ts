export function requireAccessibleName(name: string, component: string): string {
  const normalized = name.trim();
  if (normalized.length === 0) {
    throw new TypeError(`${component} exige un nom accessible non vide.`);
  }
  return normalized;
}
