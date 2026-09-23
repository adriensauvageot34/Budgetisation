import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import { BootstrapAuthenticationRequiredError } from "@/server/bootstrap/errors";
import { getCurrentHousehold } from "@/server/bootstrap/queries";
import { createCanonicalReadClient } from "@/server/canonical/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const portraitHouseholdId = "0fffacfa-aafc-5a31-99f1-d75c17e5060b";
const portraitFiles = { adrien: "adrien.png", manon: "manon.png" } as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (name !== "adrien" && name !== "manon") return new Response(null, { status: 404 });

  try {
    const { supabase } = await getAuthenticatedBootstrapClient();
    const household = await getCurrentHousehold(supabase);
    if (household?.householdId !== portraitHouseholdId) return new Response(null, { status: 404 });

    const { data, error } = await createCanonicalReadClient().storage
      .from("persona-portraits")
      .download(portraitFiles[name]);
    if (error || !data) return new Response(null, { status: 503 });

    return new Response(data, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return new Response(null, {
      status: error instanceof BootstrapAuthenticationRequiredError ? 401 : 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
