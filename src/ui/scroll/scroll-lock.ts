export type RootScrollLockSnapshot = {
  readonly scrollY: number;
  readonly bodyOverflow: string;
  readonly bodyPosition: string;
  readonly bodyTop: string;
  readonly bodyWidth: string;
  readonly bodyPaddingRight: string;
};

let lockDepth = 0;
let rootSnapshot: RootScrollLockSnapshot | null = null;

export function getRootScrollLockDepth(): number {
  return lockDepth;
}
export function acquireRootScrollLock(
  host: Window = window,
  documentHost: Document = document,
): () => void {
  if (lockDepth === 0) {
    const body = documentHost.body;
    const scrollY = host.scrollY;
    const scrollbarWidth = Math.max(0, host.innerWidth - documentHost.documentElement.clientWidth);
    rootSnapshot = {
      scrollY,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      bodyPaddingRight: body.style.paddingRight,
    };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `${-scrollY}px`;
    body.style.width = "100%";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    body.setAttribute("data-ui-scroll-locked", "");
  }
  lockDepth += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    lockDepth = Math.max(0, lockDepth - 1);
    if (lockDepth !== 0 || rootSnapshot === null) return;

    const body = documentHost.body;
    const snapshot = rootSnapshot;
    rootSnapshot = null;
    body.style.overflow = snapshot.bodyOverflow;
    body.style.position = snapshot.bodyPosition;
    body.style.top = snapshot.bodyTop;
    body.style.width = snapshot.bodyWidth;
    body.style.paddingRight = snapshot.bodyPaddingRight;
    body.removeAttribute("data-ui-scroll-locked");
    host.scrollTo({ top: snapshot.scrollY, left: host.scrollX, behavior: "auto" });
  };
}
