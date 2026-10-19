import { identity } from "@/lib/supabase";
import { syncRecord } from "@/lib/google";
import { apiResponse, assertSameOrigin, readJsonBody, RequestError } from "@/app/lib/http";
import { z } from "zod";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await identity(); if (!session) return apiResponse({ error: "Reconectează-te pentru a continua." }, 401);
    const body = await readJsonBody(request); const id = z.string().uuid().safeParse(body.id);
    if (!id.success) return apiResponse({ error: "Identificator invalid." }, 400);
    return apiResponse({ sync: await syncRecord(session.db, session.user.id, id.data) });
  } catch (e) { return apiResponse({ error: e instanceof RequestError ? e.message : "Sincronizarea nu a fost confirmată." }, e instanceof RequestError ? e.status : 500); }
}
