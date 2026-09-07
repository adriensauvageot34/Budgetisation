export type GlobalV2UxEvent =
  | "global_module_viewed"
  | "global_module_expanded"
  | "global_section_expanded"
  | "global_entity_opened"
  | "global_methodology_opened";

export function emitGlobalV2UxEvent(name: GlobalV2UxEvent, detail: Readonly<Record<string, string>>): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
