import { createRuntimeSchema } from "../../../core/validation";
import {
  parseAnalysisGlobalBreakdownReadModel,
  parseAnalysisGlobalContextsReadModel,
  parseAnalysisGlobalEvolutionReadModel,
  parseAnalysisGlobalInitialReadModel,
} from "./validation";

export const analysisGlobalInitialReadModelSchema = createRuntimeSchema(
  parseAnalysisGlobalInitialReadModel,
);
export const analysisGlobalBreakdownReadModelSchema = createRuntimeSchema(
  parseAnalysisGlobalBreakdownReadModel,
);
export const analysisGlobalEvolutionReadModelSchema = createRuntimeSchema(
  parseAnalysisGlobalEvolutionReadModel,
);
export const analysisGlobalContextsReadModelSchema = createRuntimeSchema(
  parseAnalysisGlobalContextsReadModel,
);
