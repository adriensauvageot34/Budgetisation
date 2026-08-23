import { createRuntimeSchema } from "../../../core/validation";
import {
  parseAnalysisMonthBreakdownReadModel,
  parseAnalysisMonthContextsReadModel,
  parseAnalysisMonthEvolutionReadModel,
  parseAnalysisMonthInitialReadModel,
  parseAnalysisMonthLivedReadModel,
  parseAnalysisMonthMomentsReadModel,
  parseAnalysisMonthStructureReadModel,
  parseAnalysisTargetReadModel,
} from "./validation";

export const analysisMonthInitialReadModelSchema = createRuntimeSchema(
  parseAnalysisMonthInitialReadModel,
);
export const analysisMonthBreakdownReadModelSchema = createRuntimeSchema(
  parseAnalysisMonthBreakdownReadModel,
);
export const analysisMonthEvolutionReadModelSchema = createRuntimeSchema(
  parseAnalysisMonthEvolutionReadModel,
);
export const analysisMonthContextsReadModelSchema = createRuntimeSchema(
  parseAnalysisMonthContextsReadModel,
);
export const analysisMonthStructureReadModelSchema = createRuntimeSchema(parseAnalysisMonthStructureReadModel);
export const analysisMonthLivedReadModelSchema = createRuntimeSchema(parseAnalysisMonthLivedReadModel);
export const analysisMonthMomentsReadModelSchema = createRuntimeSchema(parseAnalysisMonthMomentsReadModel);
export const analysisTargetReadModelSchema = createRuntimeSchema(parseAnalysisTargetReadModel);
