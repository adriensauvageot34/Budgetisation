import "server-only";
import { BootstrapAuthenticationRequiredError } from "@/server/bootstrap/errors";
import { ROOT_RELATION_HTTP_CONTRACT } from "@/domain/phase2/planner/root-relation-ui-contract";
import { handleRootRelationRequest, type RootRelationServerScope } from "./root-relation-admission";
import { composerRootRelationsEnabled } from "./root-relation-cutover";

/** Actual HTTP boundary, also used by the isolated fixture host. No writer dependency. */
export async function rootRelationPost(request: Request, authorize: () => Promise<RootRelationServerScope>): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Composer-Root-Relation-Contract": ROOT_RELATION_HTTP_CONTRACT };
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (!composerRootRelationsEnabled()) return reply({ ok: false, sequence: 0, code: "N1_DISABLED" }, 404);
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ ok: false, sequence: 0, code: "N1_ORIGIN_REFUSED" }, 403);
  if (request.headers.get("X-Composer-Root-Relation-Contract") !== ROOT_RELATION_HTTP_CONTRACT) return reply({ ok: false, sequence: 0, code: "N1_HTTP_CONTRACT_INVALID" }, 409);
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") return reply({ ok: false, sequence: 0, code: "N1_CONTENT_TYPE_INVALID" }, 415);
  try {
    const scope = await authorize();
    if (Number(request.headers.get("content-length") ?? 0) > 1_200_000) throw new TypeError("N1_PAYLOAD_TOO_LARGE");
    const body = await request.text();
    if (Buffer.byteLength(body) > 1_200_000) throw new TypeError("N1_PAYLOAD_TOO_LARGE");
    return reply(await handleRootRelationRequest(scope, JSON.parse(body)));
  } catch (error) {
    const auth = error instanceof BootstrapAuthenticationRequiredError;
    const code = auth ? "AUTHENTICATION_REQUIRED" : error instanceof TypeError && /^(N1_|PLANNER_|CONTEXT_|COMPOSER_)/u.test(error.message)
      ? error.message : error instanceof SyntaxError ? "N1_REQUEST_INVALID" : "N1_UNAVAILABLE";
    const status = auth ? 401 : /PERMISSION|ACCESS/.test(code) ? 403 : /STALE|VERSION_CHANGED/.test(code) ? 409 : code === "N1_UNAVAILABLE" ? 503 : 400;
    return reply({ ok: false, sequence: 0, code, message: code }, status);
  }
}
