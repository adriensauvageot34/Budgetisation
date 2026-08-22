export function closeTooltipOnEscape(
  key: string,
  close: () => void,
): boolean {
  if (key !== "Escape") return false;
  close();
  return true;
}
