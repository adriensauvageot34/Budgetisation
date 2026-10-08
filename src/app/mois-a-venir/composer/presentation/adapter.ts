import type { ComposerCardView, ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { visualFamily } from "./cluster-rules";
import type { AtomicNode, ClusterFamily, ComposerPresentationNode, ContentDensity, SpatialFamily, VisualClusterNode } from "./node-types";
import { stableVisualIdentity } from "../planner-icons/visual-identity";

const clusterLook: Readonly<Record<ClusterFamily, Pick<VisualClusterNode, "title" | "iconKey" | "width" | "height" | "spatialFamily">>> = {
  BEAUTY: { title: "Beauté", iconKey: "beauty", width: 530, height: 165, spatialFamily: "PERSONAL_CARE" },
  FOOD: { title: "Restauration", iconKey: "restaurant", width: 460, height: 165, spatialFamily: "FOOD" },
};

/** Presentation density uses only values and references already published by the Composer. */
export function controlDensity(card: ComposerCardView, model: ComposerUiModel): ContentDensity {
  const view = model.presentation.objects[card.targetRef];
  if (card.value.amount == null && card.value.count == null) return "SPARSE";
  if (view.baselineAmount !== null || view.baselineCount !== null || view.occurrenceStack?.bubbles.length || card.value.count != null) return "RICH";
  return "NORMAL";
}

export function contextDensity(card: ComposerContextCardView, model: ComposerUiModel): ContentDensity {
  const equipped = card.sockets.reduce((count, socket) => count + (model.presentation.sockets[`${card.contextOccurrenceId}:${socket.slotKey}`]?.satellites.length ?? 0), 0);
  return equipped >= 3 ? "RICH" : equipped ? "NORMAL" : "SPARSE";
}

function controlFamily(card: ComposerCardView, iconKey: string): SpatialFamily {
  if (card.kind === "SAVINGS") return "SAVINGS";
  const identity = stableVisualIdentity(card.targetRef).replace(/^HOUSEHOLD:/u, "");
  if (["household:groceries", "adrien-work-coffee", "hairdresser", "household:tobacco-vape"].includes(identity)) return "DAILY";
  if (["restaurant", "meal", "food", "fast-food", "delivery"].includes(iconKey)) return "FOOD";
  if (["beauty", "wax", "mascara", "eyeliner"].includes(iconKey)) return "PERSONAL_CARE";
  if (["clothing", "gift"].includes(iconKey)) return "PURCHASES";
  if (iconKey === "home") return "HOME";
  return "OTHER";
}

function contextFamily(templateKey: string): SpatialFamily {
  if (["night-out", "short-stay", "gift", "family-visit"].includes(templateKey)) return "MOMENTS";
  if (["restaurant", "fast-food", "delivery"].includes(templateKey)) return "FOOD";
  if (templateKey === "beauty-restock") return "PERSONAL_CARE";
  return "OTHER";
}

/** Stable affinity order; it never reads a user-facing label or financial amount. */
export function semanticRank(node: ComposerPresentationNode): number {
  if (node.kind === "CLUSTER") return node.family === "FOOD" ? 15 : 80;
  if (node.context) return ({ "night-out":40, "short-stay":50, gift:60, "family-visit":70 } as Record<string, number>)[node.context.templateKey]
    ?? ({ FOOD:18, PERSONAL_CARE:82, MOMENTS:72, PURCHASES:110, HOME:120, OTHER:140 } as Partial<Record<SpatialFamily, number>>)[node.spatialFamily] ?? 140;
  if (node.spatialFamily === "SAVINGS") return 90;
  const identity = stableVisualIdentity(node.id).replace(/^HOUSEHOLD:/u, "");
  if (identity === "household:groceries") return 0;
  if (identity === "adrien-work-coffee") return 10;
  if (identity === "hairdresser") return 20;
  if (identity === "household:tobacco-vape") return 30;
  return ({ FOOD:16, PERSONAL_CARE:81, PURCHASES:110, HOME:120, OTHER:140 } as Partial<Record<SpatialFamily, number>>)[node.spatialFamily] ?? 140;
}

/** Reversible, deterministic projection of the existing Board. No DTO or state mutation. */
export function composePresentationNodes(model: ComposerUiModel): ComposerPresentationNode[] {
  const available = new Set(model.presentation.availableReservationRefs ?? []);
  const roots: AtomicNode[] = [
    ...model.board.contexts.filter(context => !context.parentContextOccurrenceId).map(context => {
      const density = contextDensity(context, model), template = context.templateKey;
      return { id:context.contextOccurrenceId, kind:"CONTEXT" as const, context, density, spatialFamily:contextFamily(template),
        iconKey:model.presentation.objects[context.contextOccurrenceId].iconKey,
        width:template === "short-stay" ? 400 : template === "night-out" ? 350 : ["gift", "family-visit"].includes(template) ? 240 : 260,
        height:template === "short-stay" ? 212 : template === "night-out" ? 212 : template === "gift" ? 148
          : template === "family-visit" ? 142 : density === "SPARSE" ? 140 : density === "RICH" ? 190 : 170 };
    }),
    ...[...model.board.baselineControls, ...model.board.discretionaryControls, ...model.board.savings]
      .filter(control => !available.has(control.targetRef)).map(control => {
        const view = model.presentation.objects[control.targetRef], density = controlDensity(control, model);
        const spatialFamily = controlFamily(control, view.iconKey);
        return { id:control.targetRef, kind:"CONTROL" as const, control, density, spatialFamily, iconKey:view.iconKey,
          width:control.kind === "SAVINGS" ? 290 : spatialFamily === "DAILY" ? 230 : density === "SPARSE" ? 210 : 230,
          height:control.kind === "SAVINGS" ? 165 : density === "SPARSE" ? 128 : density === "RICH" ? 155 : 142 };
      }),
  ];
  const groups: Record<ClusterFamily, AtomicNode[]> = { BEAUTY:[], FOOD:[] };
  for (const node of roots) { const family = visualFamily(node, model); if (family) groups[family].push(node); }
  const clustered = new Set<string>();
  const clusters = (Object.keys(groups) as ClusterFamily[]).flatMap(family => {
    const children = groups[family];
    if (children.length < 3) return [];
    children.forEach(child => clustered.add(child.id));
    return [{ id:`cluster:${family.toLowerCase()}` as VisualClusterNode["id"], kind:"CLUSTER" as const,
      family, ...clusterLook[family], density:"RICH" as const, children, amount:null as null }];
  });
  return [...roots.filter(node => !clustered.has(node.id)), ...clusters]
    .sort((a, b) => semanticRank(a) - semanticRank(b) || a.id.localeCompare(b.id));
}
