import { NextResponse } from "next/server";
import { userDb, identity } from "@/lib/supabase";
import { appOrigin, required } from "@/lib/config";
import { seal } from "@/lib/crypto";
export async function GET(request: Request) {
  const failure = () => NextResponse.redirect(`${appOrigin()}/login?error=connection`, { headers: { "Cache-Control": "no-store" } });
  const code = new URL(request.url).searchParams.get("code");
  if (!code) return failure();
  const db = await userDb();
  const { data, error } = await db.auth.exchangeCodeForSession(code);
  const owner = !error && await identity();
  if (!owner || !data.session?.provider_refresh_token) { await db.auth.signOut(); return failure(); }
  const { error: saved } = await owner.db.from("crm_google_connections").upsert({ owner_id: owner.user.id, refresh_ciphertext: seal(data.session.provider_refresh_token, required("APP_ENCRYPTION_KEY"), owner.user.id) });
  if (saved) { await db.auth.signOut(); return failure(); }
  return NextResponse.redirect(appOrigin(), { headers: { "Cache-Control": "private, no-store" } });
}
