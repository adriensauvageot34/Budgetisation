import type { PersonaDirectModel } from "./persona-direct-presentation";
import type { PersonaEditorialModel } from "./persona-editorial";

export const globalV2PersonaPanelResource = "persona-panel";

export type GlobalV2PersonaPanelModel = {
  readonly persona: PersonaDirectModel;
  readonly personaEditorial?: PersonaEditorialModel;
};
