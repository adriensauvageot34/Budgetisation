import "server-only";
import { ROOT_RELATION_DRAFT_HTTP_CONTRACT } from "@/domain/phase2/planner/root-relation-draft-contract";
import { plannerKeys, plannerRecord } from "@/domain/phase2/planner/json";
import { BootstrapAuthenticationRequiredError } from "@/server/bootstrap/errors";
import { rootRelationDurableEnabled } from "./root-relation-durable-policy";
import { readRootRelationDurableDrafts, saveRootRelationDurableDraft, type RootRelationDurableScope } from "./root-relation-durable-service";
export async function rootRelationDurableHttp(request: Request, authorize: () => Promise<RootRelationDurableScope>) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Composer-Draft-Contract": ROOT_RELATION_DRAFT_HTTP_CONTRACT };
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (!rootRelationDurableEnabled()) return reply({ ok: false, code: "N1_DURABLE_DISABLED" }, 404);
  if (request.headers.get("X-Composer-Draft-Contract") !== ROOT_RELATION_DRAFT_HTTP_CONTRACT)
    return reply({ ok: false, code: "N1_DRAFT_TRANSPORT_UNSUPPORTED" }, 409);
  if (request.method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin)
    return reply({ ok: false, code: "N1_ORIGIN_REFUSED" }, 403);
  try {
    const scope = await authorize();
    if (request.method === "GET") return reply({ contract: ROOT_RELATION_DRAFT_HTTP_CONTRACT, kind: "SNAPSHOT",
      snapshot: await readRootRelationDurableDrafts(scope, new URL(request.url).searchParams.get("month") ?? "") });
    if (request.method !== "POST" || request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
      return reply({ ok: false, code: "N1_CONTENT_TYPE_INVALID" }, 415);
    const body = await request.text();
    if (Buffer.byteLength(body) > 1_200_000) return reply({ ok: false, code: "N1_DRAFT_TOO_LARGE" }, 413);
    const packet = plannerRecord(JSON.parse(body)); plannerKeys(packet, ["contract", "kind", "command"]);
    const receipt = await saveRootRelationDurableDraft(scope, packet);
    return reply({ contract: ROOT_RELATION_DRAFT_HTTP_CONTRACT, kind: "SAVE_RECEIPT", draft: receipt.draft, replayed: receipt.replayed });
  } catch (error) {
    if (error instanceof BootstrapAuthenticationRequiredError) return reply({ ok: false, code: "AUTHENTICATION_REQUIRED" }, 401);
    const code = error instanceof TypeError && /^(N1_|PLANNER_)[A-Z0-9_]+$/u.test(error.message) ? error.message : "N1_DURABLE_UNAVAILABLE";
    return reply({ ok: false, code }, /ACCESS|PERMISSION|PRESERV|AUTHORITY/.test(code) ? 403
      : /CONFLICT|STALE|REUSED/.test(code) ? 409 : /UNDECIDED|NOT_RECEIVED/.test(code) ? 503 : 400);
  }
}
