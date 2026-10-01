import { restaurantPlacesRequest } from "@/server/places/http";
export const dynamic = "force-dynamic";
export const POST = (request: Request) => restaurantPlacesRequest(request, "photo");
