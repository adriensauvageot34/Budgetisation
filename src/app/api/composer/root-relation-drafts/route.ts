import { rootRelationDurableRuntime } from "@/server/phase2/planner/root-relation-durable-runtime";
import { rootRelationDurableHttp } from "@/server/phase2/planner/root-relation-durable-http";
export const dynamic = "force-dynamic";
const handle = (request: Request) => rootRelationDurableHttp(request, rootRelationDurableRuntime);
export const GET = handle;
export const POST = handle;
