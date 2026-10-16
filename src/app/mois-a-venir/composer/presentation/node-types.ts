import type { ComposerCardView, ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";
import type { BaselineStructuralFact } from "@/domain/phase2/planner/baseline-contract";

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

export type FixedChargesNode = Readonly<{ id: string; kind: "FIXED"; iconKey: "home"; width: number; height: number;
  density: "NORMAL"; spatialFamily: "OTHER"; facts: readonly BaselineStructuralFact[]; detached: boolean }>;
export type ComposerPresentationNode = AtomicNode | VisualClusterNode | FixedChargesNode;
