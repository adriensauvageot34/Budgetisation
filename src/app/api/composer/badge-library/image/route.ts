import { badgeRequest } from "@/server/commerce/badge-http";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => badgeRequest(request, "IMAGE");
