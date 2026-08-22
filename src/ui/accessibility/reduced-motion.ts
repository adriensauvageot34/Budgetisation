const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(host: Window = window): boolean {
  return host.matchMedia(reducedMotionQuery).matches;
}
export function observeReducedMotion(
  listener: (reduced: boolean) => void,
  host: Window = window,
): () => void {
  const query = host.matchMedia(reducedMotionQuery);
  const onChange = (event: MediaQueryListEvent) => listener(event.matches);
  listener(query.matches);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
