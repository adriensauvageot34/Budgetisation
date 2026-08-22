import { createRuntimeSchema } from "../validation";
import type { AnalysisScope } from "./types";
import { parseAnalysisScope } from "./validation";

export const analysisScopeSchema = createRuntimeSchema<AnalysisScope>(
  parseAnalysisScope,
);
