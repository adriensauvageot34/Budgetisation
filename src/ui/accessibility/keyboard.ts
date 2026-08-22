export type RovingOrientation = "horizontal" | "vertical";

export function isButtonActivationKey(key: string): boolean {
  return key === "Enter" || key === " ";
}
export function isLinkActivationKey(key: string): boolean {
  return key === "Enter";
}

export function rovingDirectionForKey(
  key: string,
  orientation: RovingOrientation,
): -1 | 1 | "first" | "last" | null {
  if (key === "Home") return "first";
  if (key === "End") return "last";
  if (orientation === "horizontal") {
    if (key === "ArrowLeft") return -1;
    if (key === "ArrowRight") return 1;
  } else {
    if (key === "ArrowUp") return -1;
    if (key === "ArrowDown") return 1;
  }
  return null;
}
