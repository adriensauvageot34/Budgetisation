import "server-only";
import { createHash } from "node:crypto";
import type { YearMonth } from "@/core/time";
import { isArchivedRealizedMonth } from "@/domain/phase2/planner/realized-month-entry";
import { createCanonicalReadClient } from "@/server/canonical/client";
import type { MonthSourceCache } from "../month-source-cache";
import {
  readRealizedCalendarSource,
  readRealizedMonth,
  type RealizedBoard,
  type RealizedBootstrap,
  type RealizedCalendarSource,
} from "./realized-month";

// Bump when the archived read models or their projector rules change.
const projectionVersion = "composer-realized-v1";
const projection = () => createHash("sha256").update(JSON.stringify([
  projectionVersion, process.env.COMPOSER_WORK_PROFILES, process.env.COMPOSER_COUPLE_PORTRAIT,
])).digest("hex");

type SnapshotStatus = "hit" | "published" | "live";

function hasPayload(raw: unknown, month: YearMonth, kind: "board" | "calendar"): boolean {
  if (!raw || typeof raw !== "object") return false;
  const value = raw as Record<string, unknown>;
  if (value.month !== month || !Array.isArray(value.cards)) return false;
  return kind === "calendar" || (Array.isArray(value.groups) && typeof value.net === "string"
    && Number.isInteger(value.operationCount) && value.totals != null
    && value.participantPortraits != null && value.julyPortraits != null);
}

async function snapshot<T extends RealizedBoard | RealizedCalendarSource>(
  context: RealizedBootstrap,
  month: YearMonth,
  kind: "board" | "calendar",
  readLive: () => Promise<T>,
): Promise<{ value: T; status: SnapshotStatus }> {
  const period = context.periods.find(period => period.month === `${month}-01`);
  if (!context.household || !context.revision || !isArchivedRealizedMonth(month)
    || !period?.isClosed || period.financeStatus !== "complete") {
    return { value: await readLive(), status: "live" };
  }
  const client = createCanonicalReadClient();
  const input = { p_household: context.household.householdId, p_month: `${month}-01`,
    p_kind: kind, p_projection: projection() };
  const { data: stored, error } = await client.rpc("read_composer_realized_snapshot_v1", input).maybeSingle();
  const row = !error && stored as { payload: unknown; source_stamp: string } | false | null;
  if (row && hasPayload(row.payload, month, kind)) return { value: row.payload as T, status: "hit" };

  const value = await readLive();
  if (!row || !row.source_stamp) return { value, status: "live" };
  const publication = await client.rpc("publish_composer_realized_snapshot_v1", {
    ...input, p_stamp: row.source_stamp, p_payload: value,
  });
  return { value, status: !publication.error && publication.data === true ? "published" : "live" };
}

export function archivedComposerBoard(context: RealizedBootstrap, month: YearMonth, cache?: MonthSourceCache) {
  return snapshot(context, month, "board", () => readRealizedMonth(context, month, cache));
}

export function archivedComposerCalendar(context: RealizedBootstrap, month: YearMonth, cache?: MonthSourceCache) {
  return snapshot(context, month, "calendar", () => readRealizedCalendarSource(context, month, cache));
}
