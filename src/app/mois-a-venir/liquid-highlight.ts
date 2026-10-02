export type LiquidHighlightPose = { x: number; y: number; width: number; height?: number };

const transform = (x: number, y: number, width: number) =>
  "translate3d(" + x + "px," + y + "px,0) scaleX(" + width / 100 + ")";

/** Presentation only. A single 100px plate moves; its labels never stretch. */
export function moveLiquidHighlight(plate: HTMLElement, track: HTMLElement, target: LiquidHighlightPose,
  previous: Animation | undefined, immediate: boolean): Animation | undefined {
  // Sample before cancelling, so fast reversals continue from the actual displayed pose.
  const from = plate.getBoundingClientRect(), origin = track.getBoundingClientRect();
  const border = getComputedStyle(track);
  const x = from.left - origin.left - parseFloat(border.borderLeftWidth) + track.scrollLeft;
  const y = from.top - origin.top - parseFloat(border.borderTopWidth) + track.scrollTop;
  const ready = plate.dataset.ready === "true";
  previous?.cancel();
  const destination = transform(target.x, target.y, target.width);
  plate.style.transform = destination;
  if (target.height !== undefined) plate.style.height = target.height + "px";
  plate.dataset.ready = "true";
  if (immediate || !ready) return;
  const dx = target.x - x, dy = target.y - y, distance = Math.hypot(dx, dy);
  const stretch = Math.min(32, distance * .22);
  return plate.animate([
    { transform: transform(x, y, from.width) },
    { transform: transform(x + dx * .55 - stretch / 2, y + dy * .55, Math.max(from.width, target.width) + stretch), offset: .55 },
    { transform: destination },
  ], { duration: 420 + Math.min(140, distance / 4), easing: "cubic-bezier(.22,.75,.18,1)" });
}
