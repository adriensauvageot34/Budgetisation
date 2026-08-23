import { getDayDrawerNavigationState, type NavigationControllerSnapshot } from "@/navigation";

export type ProductOverlayState = {
  readonly dayOpen: boolean;
  readonly explorationOpen: boolean;
  readonly daySuspended: boolean;
  readonly topmost: "none" | "day_drawer" | "exploration";
};

export class ProductOverlayCoordinator {
  resolve(snapshot: NavigationControllerSnapshot | null): ProductOverlayState {
    if (snapshot === null) {
      return { dayOpen: false, explorationOpen: false, daySuspended: false, topmost: "none" };
    }
    const dayOpen = getDayDrawerNavigationState(snapshot.history.root) !== null;
    const explorationOpen = snapshot.history.exploration !== null;
    return {
      dayOpen,
      explorationOpen,
      daySuspended: dayOpen && explorationOpen,
      topmost: explorationOpen ? "exploration" : dayOpen ? "day_drawer" : "none",
    };
  }
}
