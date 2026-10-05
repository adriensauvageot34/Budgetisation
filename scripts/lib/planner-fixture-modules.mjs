import path from "node:path";
import { require } from "./phase2-ts-loader.mjs";

// Reuse the Phase 2 test loader. These fixtures never load .env or a live client.
export const plannerModule = name => require(path.resolve("src/domain/phase2/planner", `${name}.ts`));
export const plannerRepositoryModule = () => require(path.resolve("src/server/phase2/planner/repository.ts"));
