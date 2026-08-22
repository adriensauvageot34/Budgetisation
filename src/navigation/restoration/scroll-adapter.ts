import type { ScrollContainerRef } from "../contracts/restoration";

export interface ScrollAdapter {
  getScrollY(container: ScrollContainerRef): number;
  scrollTo(container: ScrollContainerRef, y: number): void;
  getAnchorTop(container: ScrollContainerRef, element: HTMLElement): number;
}
