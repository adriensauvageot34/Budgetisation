import { badgeRequest } from "@/server/commerce/badge-http";
export const dynamic = "force-dynamic";
export const POST = (request: Request) => badgeRequest(request, "COMMAND");
export const PUT = (request: Request) => badgeRequest(request, "UPLOAD");
