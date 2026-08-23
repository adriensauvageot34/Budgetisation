import { createRuntimeSchema } from "../../../core/validation";
import {
  parseAnalysisGlobalBreakdownReadModel,
  parseAnalysisGlobalBaselineReadModel,
  parseAnalysisGlobalContextsReadModel,
  parseAnalysisGlobalEvolutionReadModel,
  parseAnalysisGlobalHabitsReadModel,
  parseAnalysisGlobalInitialReadModel,
  parseAnalysisGlobalProfilesReadModel,
  parseAnalysisGlobalTypicalReadModel,
  parseAnalysisGlobalUniverseReadModel,
} from "./validation";

export const analysisGlobalInitialReadModelSchema = createRuntimeSchema(
  parseAnalysisGlobalInitialReadModel,
);
export const analysisGlobalBaselineReadModelSchema = createRuntimeSchema(parseAnalysisGlobalBaselineReadModel);
export const analysisGlobalTypicalReadModelSchema = createRuntimeSchema(parseAnalysisGlobalTypicalReadModel);
export const analysisGlobalBreakdownReadModelSchema = createRuntimeSchema(
  parseAnalysisGlobalBreakdownReadModel,
);
export const analysisGlobalEvolutionReadModelSchema = createRuntimeSchema(
  parseAnalysisGlobalEvolutionReadModel,
);
export const analysisGlobalContextsReadModelSchema = createRuntimeSchema(
  parseAnalysisGlobalContextsReadModel,
);
export const analysisGlobalHabitsReadModelSchema = createRuntimeSchema(parseAnalysisGlobalHabitsReadModel);
export const analysisGlobalProfilesReadModelSchema = createRuntimeSchema(parseAnalysisGlobalProfilesReadModel);
export const analysisGlobalUniverseReadModelSchema = createRuntimeSchema(parseAnalysisGlobalUniverseReadModel);
