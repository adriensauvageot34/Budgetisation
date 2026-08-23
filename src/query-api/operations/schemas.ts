import { createRuntimeSchema } from "../../core/validation";
import { parseOperationsBrowseReadModel } from "./validation";

export const operationsBrowseReadModelSchema = createRuntimeSchema(
  parseOperationsBrowseReadModel,
);
