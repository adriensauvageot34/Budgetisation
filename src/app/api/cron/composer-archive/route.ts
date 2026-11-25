import { timingSafeEqual } from "node:crypto";
import { parseHouseholdId } from "@/core/identity";
import { parseHouseholdTimeZone, parseYearMonth } from "@/core/time";
import { isArchivedRealizedMonth } from "@/domain/phase2/planner/realized-month-entry";
import { getAnalysisPeriods, getHouseholdPersons, getHouseholdRevision } from "@/server/bootstrap/queries";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { archivedComposerBoard, archivedComposerCalendar } from "@/server/phase2/planner/realized-snapshots";

export const maxDuration = 60;

// The operator supplies an expiring token bound to one household for a backfill.
export async function POST(request: Request) {
  const [expiry, token, owner] = (process.env.COMPOSER_ARCHIVE_WARMUP ?? "").split(":");
  const expiresAt = Number(expiry);
  if (!token || !owner || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
    return new Response(null, { status: 404 });
  }
  const expected = Buffer.from(`Bearer ${token}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return new Response(null, { status: 401 });
  }
  const month = new URL(request.url).searchParams.get("month");
  if (!month || !isArchivedRealizedMonth(month)) return new Response(null, { status: 400 });
  const householdId = parseHouseholdId(owner);
  const client = createCanonicalReadClient();
  const [household, persons, periods, revision] = await Promise.all([
    client.from("households").select("name,timezone").eq("household_id", householdId).single(),
    getHouseholdPersons(client, householdId),
    getAnalysisPeriods(client, householdId),
    getHouseholdRevision(client, householdId),
  ]);
  if (household.error || !revision) return new Response(null, { status: 409 });
  const context = {
    user: { id: "composer-archive-publisher" },
    household: { householdId, name: household.data.name, timezone: parseHouseholdTimeZone(household.data.timezone) },
    persons, periods, revision,
  };
  const target = parseYearMonth(month);
  const [board, calendar] = await Promise.all([
    archivedComposerBoard(context, target),
    archivedComposerCalendar(context, target),
  ]);
  return Response.json({
    month,
    board: { status: board.status, cards: board.value.cards.length, operations: board.value.operationCount },
    calendar: { status: calendar.status, cards: calendar.value.cards.length },
  }, { status: board.status === "live" || calendar.status === "live" ? 503 : 200 });
}
