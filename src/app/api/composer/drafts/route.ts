import { BootstrapAuthenticationRequiredError } from "@/server/bootstrap/errors";
import { plannerMonth, plannerRecord } from "@/domain/phase2/planner/json";
import type { ComposerDraftLifecycleCommand, ComposerDraftSaveCommand } from "@/domain/phase2/planner/composer-draft-contract";
import { COMPOSER_DRAFT_HTTP_CONTRACT } from "@/domain/phase2/planner/composer-draft-contract";
import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { composerDraftAutosaveEnabledFor } from "@/server/phase2/planner/composer-draft-cutover";
import { changeComposerDraftLifecycle, readComposerDrafts, saveComposerDraft } from "@/server/phase2/planner/composer-draft-service";

export const dynamic = "force-dynamic";
const contractHeader = "X-Composer-Draft-Contract";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie", [contractHeader]: COMPOSER_DRAFT_HTTP_CONTRACT };
const maxRequestBytes = 1_200_000;

function reply(value: unknown, status = 200) {
  return Response.json(value, { status, headers });
}

async function scope() {
  const { supabase, userId, householdId } = await authorizedPlanner();
  if (!composerDraftAutosaveEnabledFor(userId)) throw new TypeError("COMPOSER_DRAFT_DISABLED");
  return { supabase, userId, householdId };
}

async function boundary(run: () => Promise<Response>) {
  try { return await run(); }
  catch (error) {
    if (error instanceof BootstrapAuthenticationRequiredError) return reply({ code: "AUTHENTICATION_REQUIRED" }, 401);
    if (error instanceof TypeError && error.message === "COMPOSER_DRAFT_DISABLED") return reply({ code: "COMPOSER_DRAFT_DISABLED" }, 403);
    if (error instanceof TypeError && /^(PLANNER_|COMPOSER_DRAFT_|INVALID_)/u.test(error.message))
      return reply({ code: "DRAFT_REQUEST_INVALID" }, 400);
    return reply({ code: "DRAFT_UNAVAILABLE" }, 503);
  }
}

export const GET = (request: Request) => boundary(async () => {
  if (request.headers.get(contractHeader) !== COMPOSER_DRAFT_HTTP_CONTRACT)
    return reply({ code: "DRAFT_CONTRACT_INCOMPATIBLE" }, 409);
  const month = plannerMonth(new URL(request.url).searchParams.get("month"));
  return reply(await readComposerDrafts(await scope(), month));
});

export const POST = (request: Request) => boundary(async () => {
  // Cookie authentication requires an exact same-origin POST guard. A request
  // from an old build still reaches this stable path without a Server Action ID.
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ code: "DRAFT_ORIGIN_REFUSED" }, 403);
  if (request.headers.get(contractHeader) !== COMPOSER_DRAFT_HTTP_CONTRACT)
    return reply({ code: "DRAFT_CONTRACT_INCOMPATIBLE" }, 409);
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
    return reply({ code: "DRAFT_CONTENT_TYPE_INVALID" }, 415);
  if (Number(request.headers.get("content-length") ?? 0) > maxRequestBytes)
    return reply({ code: "DRAFT_TOO_LARGE" }, 413);
  const body = await request.text();
  if (Buffer.byteLength(body) > maxRequestBytes) return reply({ code: "DRAFT_TOO_LARGE" }, 413);
  let input: Record<string, unknown>;
  try { input = plannerRecord(JSON.parse(body)); }
  catch { return reply({ code: "DRAFT_REQUEST_INVALID" }, 400); }
  if (Object.keys(input).some(key => key !== "kind" && key !== "command")) return reply({ code: "DRAFT_REQUEST_INVALID" }, 400);
  if (input.kind !== "SAVE" && input.kind !== "ARCHIVE" && input.kind !== "RESTORE")
    return reply({ code: "DRAFT_REQUEST_INVALID" }, 400);
  let command: Record<string, unknown>;
  try { command = plannerRecord(input.command); }
  catch { return reply({ code: "DRAFT_REQUEST_INVALID" }, 400); }
  const owner = await scope();
  const result = input.kind === "SAVE"
    ? await saveComposerDraft(owner, command as unknown as ComposerDraftSaveCommand)
    : await changeComposerDraftLifecycle(owner, input.kind, command as unknown as ComposerDraftLifecycleCommand);
  return reply(result);
});
