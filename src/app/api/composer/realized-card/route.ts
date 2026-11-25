import { realizedCardViews } from "@/app/mois-a-venir/composer/realized-card-view";
import { isArchivedRealizedMonth, isImportedRealizedMonth, JULY_COMPOSER_MONTH } from "@/domain/phase2/planner/realized-month-entry";
import { BootstrapAuthenticationRequiredError } from "@/server/bootstrap/errors";
import { plannerComposerEnabled } from "@/server/phase2/planner/cutover";
import { projectJulyPilot } from "@/server/phase2/planner/july-pilot";
import { readComposerRealizedBoard } from "@/server/phase2/planner/read-composer-realized-board";

export const dynamic = "force-dynamic";
const headers = { "cache-control": "private, no-store" };

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const month = search.get("month"), id = search.get("card"), mode = search.get("mode"), view = search.get("view");
  if (!month || !id || id.length > 256 || (view !== "flat" && view !== "category")
    || (mode !== "realized" && mode !== "pilot") || (mode === "pilot" && month !== JULY_COMPOSER_MONTH)
    || (!isArchivedRealizedMonth(month) && !isImportedRealizedMonth(month) && month !== JULY_COMPOSER_MONTH)) {
    return new Response(null, { status: 400, headers });
  }
  if (!plannerComposerEnabled()) return new Response(null, { status: 404, headers });
  try {
    const source = await readComposerRealizedBoard(month);
    if (!source) return new Response(null, { status: 404, headers });
    const board = mode === "pilot" ? projectJulyPilot(source) : source;
    const detail = realizedCardViews(board, view === "category").find(({ card }) => card.id === id)?.card;
    return detail ? Response.json(detail, { headers }) : new Response(null, { status: 404, headers });
  } catch (error) {
    return new Response(null, { status: error instanceof BootstrapAuthenticationRequiredError ? 401 : 503, headers });
  }
}
