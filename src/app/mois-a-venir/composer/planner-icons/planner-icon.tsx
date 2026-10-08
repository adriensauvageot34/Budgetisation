import { memo } from "react";
import { resolveVisualIcon } from "./icon-registry";

const sizes = { CARD: 76, SATELLITE: 40, PALETTE: 40, LIBRARY: 44, CLUSTER: 96 } as const;
/** Facade shared by Library, Board, satellites, palette and popovers. */
export const PlannerIcon = memo(function PlannerIcon({ iconKey, identityRef, scale = "CARD", className }: { iconKey: string; identityRef?: string; scale?: keyof typeof sizes; className?: string }) {
  const Icon = resolveVisualIcon(iconKey, identityRef);
  return <span data-planner-icon={iconKey} data-icon-scale={scale} className={className} aria-hidden="true"><Icon size={sizes[scale]} /></span>;
});
