import { createRuntimeSchema } from "../../../core/validation";
import {
  parseAnalysisMonthBreakdownReadModel,
  parseAnalysisMonthContextsReadModel,
  parseAnalysisMonthEvolutionReadModel,
  parseAnalysisMonthInitialReadModel,
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
