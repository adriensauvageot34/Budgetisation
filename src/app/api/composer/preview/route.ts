import { BootstrapAuthenticationRequiredError } from "@/server/bootstrap/errors";
import { plannerInteger, plannerKeys, plannerMonth, plannerRecord } from "@/domain/phase2/planner/json";
import { parsePlanSemanticState } from "@/domain/phase2/planner/semantic-state";
import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { handleComposerRequest } from "@/server/phase2/planner/composer-service";
import { observeSnapshot } from "@/server/phase2/planner/snapshot-observation";

export const dynamic = "force-dynamic";
export const preferredRegion = "fra1";
const contract = "composer-preview-http@1", header = "X-Composer-Preview-Contract";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie", [header]: contract };
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers });

/** Read-only transport. Apply, CAS and all writers stay outside this route. */
export async function POST(request: Request) {
  if (process.env.COMPOSER_PREVIEW_HTTP_ENABLED !== "1") return reply({ code: "PREVIEW_HTTP_DISABLED" }, 404);
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ code: "PREVIEW_ORIGIN_REFUSED" }, 403);
  if (request.headers.get(header) !== contract) return reply({ code: "PREVIEW_CONTRACT_INCOMPATIBLE" }, 409);
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
    return reply({ code: "PREVIEW_CONTENT_TYPE_INVALID" }, 415);
  if (Number(request.headers.get("content-length") ?? 0) > 1_200_000) return reply({ code: "PREVIEW_TOO_LARGE" }, 413);
  try {
    const body = await request.text();
    if (Buffer.byteLength(body) > 1_200_000) return reply({ code: "PREVIEW_TOO_LARGE" }, 413);
    const input = plannerRecord(JSON.parse(body));
    plannerKeys(input, ["kind", "sequence", "targetMonth", "draft"]);
    if (input.kind !== "READ" && input.kind !== "SUGGESTIONS") return reply({ code: "PREVIEW_READ_ONLY" }, 400);
    const sequence = plannerInteger(input.sequence), targetMonth = plannerMonth(input.targetMonth);
    const draft = parsePlanSemanticState(input.draft);
    if (draft.targetMonth !== targetMonth) return reply({ code: "PREVIEW_MONTH_INVALID" }, 400);
    const kind = input.kind;
    const observed = await observeSnapshot(async () => {
      const { deps, householdId } = await authorizedPlanner();
      return handleComposerRequest(deps, householdId, { kind, sequence, targetMonth, draft });
    });
    return reply(observed.metrics ? { ...observed.value, snapMetrics: observed.metrics } : observed.value);
  } catch (error) {
    if (error instanceof BootstrapAuthenticationRequiredError) return reply({ code: "AUTHENTICATION_REQUIRED" }, 401);
    if (error instanceof SyntaxError || error instanceof TypeError && /^(PLANNER_|COMPOSER_)/u.test(error.message))
      return reply({ code: "PREVIEW_REQUEST_INVALID" }, 400);
    return reply({ code: "PREVIEW_UNAVAILABLE" }, 503);
  }
}
