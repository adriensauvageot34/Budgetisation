import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { AtomicNode, ClusterFamily } from "./node-types";
import { stableVisualIdentity } from "../planner-icons/visual-identity";

/** Stable published identities only; no labels, people or monetary values. */
export function visualFamily(node: AtomicNode, model: ComposerUiModel): ClusterFamily | null {
  if (node.context) {
    if (node.context.templateKey === "beauty-restock") return "BEAUTY";
    if (["restaurant", "fast-food", "delivery"].includes(node.context.templateKey)) return "FOOD";
    return null;
  }
  if (!node.control || node.control.kind === "SAVINGS") return null;
  const ref = stableVisualIdentity(node.control.targetRef);
  const icon = model.presentation.objects[node.id]?.iconKey;
  if (ref === "adrien-work-coffee") return null; // the distinct cup stays a simple object
  if (ref.startsWith("need:maquillage_manon_") || ref.startsWith("need:cire_adrien")
    || ref.startsWith("need:haircare_adrien_cire") || ref.startsWith("renewal:manon-")
    || icon === "beauty") return "BEAUTY";
  if (ref === "adrien-work-meals" || ref === "manon-work-meals") return "FOOD";
  if (["meal", "restaurant", "food", "fast-food", "delivery"].includes(icon)) return "FOOD";
  return null;
}
