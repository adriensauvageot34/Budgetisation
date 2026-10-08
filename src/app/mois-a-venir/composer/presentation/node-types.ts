import type { ComposerCardView, ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";

export type ContentDensity = "SPARSE" | "NORMAL" | "RICH";
export type SpatialFamily = "DAILY" | "FOOD" | "MOMENTS" | "PERSONAL_CARE" | "SAVINGS" | "PURCHASES" | "HOME" | "OTHER";

export type AtomicNode = Readonly<{
  id: string; kind: "CONTROL" | "CONTEXT"; iconKey: string; width: number; height: number;
  density: ContentDensity; spatialFamily: SpatialFamily;
  control?: ComposerCardView; context?: ComposerContextCardView;
}>;

export type ClusterFamily = "BEAUTY" | "FOOD";
export type VisualClusterNode = Readonly<{
  id: `cluster:${Lowercase<ClusterFamily>}`; kind: "CLUSTER"; family: ClusterFamily;
  title: string; iconKey: string; width: number; height: number;
  density: "RICH"; spatialFamily: SpatialFamily;
  children: readonly AtomicNode[];
  /** No financial total is synthesized by React. */
  amount: null;
}>;

export type ComposerPresentationNode = AtomicNode | VisualClusterNode;
