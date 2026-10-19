import { assertSameOrigin, apiResponse } from "@/app/lib/http";
import { userDb } from "@/lib/supabase";
export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return apiResponse({ error: "Solicitare nepermisă." }, 403); }
  await (await userDb()).auth.signOut();
  return apiResponse({ ok: true });
}
