import {
  navigationRestorationCauseSchema,
  scrollMemorySchema,
  type NavigationRestorationCause,
  type ScrollMemory,
  type ScrollRestorationSelection,
} from "../contracts/restoration";

export function selectScrollRestoration(
  cause: NavigationRestorationCause,
  sessionMemory: ScrollMemory | null,
  snapshotMemory: ScrollMemory | null = null,
): ScrollRestorationSelection {
  const parsedCause = navigationRestorationCauseSchema.parse(cause);

  if (parsedCause.kind === "voluntary_month_navigation") {
    return { kind: "top" };
  }
  if (
    parsedCause.kind === "browser_history" ||
    parsedCause.kind === "checkpoint_restore"
  ) {
    return snapshotMemory === null
      ? { kind: "top" }
      : { kind: "memory", memory: scrollMemorySchema.parse(snapshotMemory) };
  }
  return sessionMemory === null
    ? { kind: "top" }
    : { kind: "memory", memory: scrollMemorySchema.parse(sessionMemory) };
}
