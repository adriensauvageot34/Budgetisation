import { timingSafeEqual } from "node:crypto";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { republishRegisteredActivityHistory } from "@/server/phase2/planner/activity-history-maintenance";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET, token = request.headers.get("authorization");
  if (!secret || !token || Buffer.byteLength(token)!==Buffer.byteLength(`Bearer ${secret}`)
    || !timingSafeEqual(Buffer.from(token),Buffer.from(`Bearer ${secret}`))) return new Response(null,{status:401});
  if (process.env.COMPOSER_P14_SNAP_PREPARE_ENABLED!=="1") return Response.json({status:"OFF"});
  return Response.json(await republishRegisteredActivityHistory(createCanonicalReadClient()));
}
