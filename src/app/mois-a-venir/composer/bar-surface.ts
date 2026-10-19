/** Transient presentation only: no amount, identity or Draft field is changed. */
export type BarSurface = Readonly<{ scene: string; size: "compact" | "medium" | "wide"; preferredWidth: number; minUsableWidth: number }>;
export type InventoryAnchor = Readonly<{ id: string; page: number; column: number; row: number }>;

export function barSurface(scene: string, rich = false, advanced = false, hasItems = false): BarSurface {
  const wide = scene === "summary" && rich || scene === "legacy" || scene === "row" && advanced;
  const medium = scene === "summary" && hasItems || ["date", "place", "google", "manual-place", "endpoint", "outbound", "return", "vehicle", "venue-change", "known-routes", "drinks", "before"].includes(scene);
  return { scene, size: wide ? "wide" : medium ? "medium" : "compact",
    preferredWidth: scene === "date" ? 420 : wide ? 720 : medium ? 560 : 460,
    minUsableWidth: scene === "date" ? 350 : wide ? 460 : 360 };
}
