import type { ComponentSlotDefinition, ComponentSlotSelectionV1 } from "./component-contract";

export type ContextFieldDefinition = Readonly<{ fieldKey: string; kind: "TEXT" | "DATE" | "CHOICE";
  required: boolean; choices?: readonly string[] }>;
export type ContextCapability = Readonly<{ slotKey: string; action: "SELECT_COMPONENT" | "ATTACH_CHILD_CONTEXT" | "SELECT_MOBILITY_INTENT";
  cardinality: ComponentSlotDefinition["cardinality"]; selectionMode: "ONE_OF" | "MANY";
  optionKeys: readonly string[]; childTemplateKeys: readonly string[] }>;
export type ContextTemplateV1 = Readonly<{ templateKey: string; label: string;
  family: "FOOD" | "SOCIAL" | "ACTIVITY" | "VISIT" | "PURCHASE" | "TRAVEL" | "HOME" | "BEAUTY" | "OTHER";
  version: string; fields: readonly ContextFieldDefinition[]; componentSlots: readonly ComponentSlotDefinition[];
  capabilities: readonly ContextCapability[]; structuralDefaults: Readonly<Record<string, ComponentSlotSelectionV1>>;
  minimumEconomicSelections: number }>;
export type ContextRegistryV1 = Readonly<{ version: string; templates: readonly ContextTemplateV1[] }>;
