import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { visualFamily } from "./cluster-rules";
import type { AtomicNode, ClusterFamily, ComposerPresentationNode, VisualClusterNode } from "./node-types";
import { stableVisualIdentity } from "../planner-icons/visual-identity";

const clusterLook: Readonly<Record<ClusterFamily, Pick<VisualClusterNode, "title" | "iconKey" | "width" | "height">>> = {
  BEAUTY: { title: "Beauté", iconKey: "beauty", width: 390, height: 220 },
  FOOD: { title: "Restauration", iconKey: "restaurant", width: 430, height: 220 },
};

function rank(node: ComposerPresentationNode, model: ComposerUiModel): number {
  if (node.kind === "CLUSTER") return node.family === "BEAUTY" ? 7 : 8;
  if (node.context) return ({ "night-out": 5, "short-stay": 6, gift: 9, "family-visit": 10 } as Record<string, number>)[node.context.templateKey] ?? 20;
  if (node.control?.kind === "SAVINGS") return 4;
  if (stableVisualIdentity(node.id) === "adrien-work-coffee") return 1;
  const icon = model.presentation.objects[node.id]?.iconKey;
  return ({ groceries: 0, haircut: 2, tobacco: 3, gift: 9, family: 10 } as Record<string, number>)[icon] ?? 20;
}

/** Reversible, deterministic projection of the existing Board. No DTO or state mutation. */
export function composePresentationNodes(model: ComposerUiModel): ComposerPresentationNode[] {
  const available = new Set(model.presentation.availableReservationRefs ?? []);
  const roots: AtomicNode[] = [
    ...model.board.contexts.filter(context => !context.parentContextOccurrenceId).map(context => ({
      id: context.contextOccurrenceId, kind: "CONTEXT" as const, context,
      iconKey: model.presentation.objects[context.contextOccurrenceId].iconKey,
      width: ["gift", "family-visit"].includes(context.templateKey) ? 260 : model.presentation.objects[context.contextOccurrenceId].variant === "COMPOSITE" ? 340 : 230,
      height: ["gift", "family-visit"].includes(context.templateKey) ? 205 : model.presentation.objects[context.contextOccurrenceId].variant === "COMPOSITE" ? 255 : 205,
    })),
    ...[...model.board.baselineControls, ...model.board.discretionaryControls, ...model.board.savings]
      .filter(control => !available.has(control.targetRef)).map(control => ({
        id: control.targetRef, kind: "CONTROL" as const, control,
        iconKey: model.presentation.objects[control.targetRef].iconKey,
        width: control.kind === "SAVINGS" ? 290 : 230,
        height: control.kind === "SAVINGS" ? 190 : 184,
      })),
  ];
  const groups: Record<ClusterFamily, AtomicNode[]> = { BEAUTY: [], FOOD: [] };
  for (const node of roots) { const family = visualFamily(node, model); if (family) groups[family].push(node); }
  const clustered = new Set<string>();
  const clusters = (Object.keys(groups) as ClusterFamily[]).flatMap(family => {
    const children = groups[family];
    if (children.length < 3) return [];
    children.forEach(child => clustered.add(child.id));
    return [{ id: `cluster:${family.toLowerCase()}` as VisualClusterNode["id"], kind: "CLUSTER" as const,
      family, ...clusterLook[family], children, amount: null as null }];
  });
  return [...roots.filter(node => !clustered.has(node.id)), ...clusters]
    .sort((a, b) => rank(a, model) - rank(b, model) || a.id.localeCompare(b.id));
}
