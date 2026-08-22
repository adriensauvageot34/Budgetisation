import { createRuntimeSchema } from "../../core/validation";
import { normalizeQueryRequest } from "./normalize";

export const normalizedQueryRequestSchema = createRuntimeSchema(
  normalizeQueryRequest,
);
