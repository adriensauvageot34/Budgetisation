import { preferenceRequest } from "@/server/commerce/preference-http";
export const dynamic="force-dynamic";
export const POST=(request:Request)=>preferenceRequest(request);
