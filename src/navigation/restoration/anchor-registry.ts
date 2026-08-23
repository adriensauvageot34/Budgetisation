import { semanticAnchorSchema, type SemanticAnchor } from "../contracts/anchors";

export interface AnchorRegistry {
  register(anchor: SemanticAnchor, element: HTMLElement): () => void;
  resolve(anchor: SemanticAnchor): HTMLElement | null;
}

function createAnchorKey(anchor: SemanticAnchor): string {
  const parsed = semanticAnchorSchema.parse(anchor);
  return JSON.stringify([
    parsed.moduleId,
    parsed.item?.kind ?? null,
    parsed.item?.id ?? null,
    parsed.itemKey ?? null,
  ]);
}

export class BrowserAnchorRegistry implements AnchorRegistry {
  private readonly elements = new Map<string, HTMLElement>();

  register(anchor: SemanticAnchor, element: HTMLElement): () => void {
    const key = createAnchorKey(anchor);
    this.elements.set(key, element);
    return () => {
      if (this.elements.get(key) === element) this.elements.delete(key);
    };
  }

  resolve(anchor: SemanticAnchor): HTMLElement | null {
    return this.elements.get(createAnchorKey(anchor)) ?? null;
  }
}
