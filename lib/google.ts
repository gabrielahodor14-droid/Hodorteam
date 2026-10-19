import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { required } from "./config";
import { unseal } from "./crypto";

import { GoogleApi, writeSheet, writeCalendar, UserSyncError, type Sync, type Claim } from "./google-api";
async function accessToken(owner: string, db: SupabaseClient) {
  const { data, error } = await db.from("crm_google_connections").select("refresh_ciphertext").eq("owner_id", owner).maybeSingle();
  if (error || !data) throw new UserSyncError("Reconectează contul Google pentru a activa sincronizarea.");
  const refresh = unseal(data.refresh_ciphertext, required("APP_ENCRYPTION_KEY"), owner);
  const result = await fetch("https://oauth2.googleapis.com/token", { method: "POST", cache: "no-store", signal: AbortSignal.timeout(7000), body: new URLSearchParams({ client_id: required("GOOGLE_CLIENT_ID"), client_secret: required("GOOGLE_CLIENT_SECRET"), refresh_token: refresh, grant_type: "refresh_token" }) });
  const token = await result.json() as { access_token?: string };
  if (!result.ok || !token.access_token) throw new UserSyncError("Reconectează contul Google și acordă accesul la Sheets și Calendar.");
  return token.access_token;
}
export async function syncRecord(db: SupabaseClient, owner: string, id: string): Promise<Sync> {
  const token = crypto.randomUUID();
  const { data, error } = await db.rpc("crm_claim_sync", { p_id: id, p_token: token });
  if (error || !data) return { state: "pending", message: "Sincronizarea este în curs sau nu poate porni. Reîncarcă agenda." };
  const claim = data as Claim;
  const status: Sync = { state: "pending" };
  try {
    const api = new GoogleApi(await accessToken(owner, db));
    await writeSheet(api, claim); status.sheets = true;
    if (claim.kind === "viewing") { await writeCalendar(api, owner, claim); status.calendar = true; }
    status.state = "synced"; status.at = new Date().toISOString();
  } catch (e) {
    status.state = "error";
    status.message = e instanceof UserSyncError ? e.message : "Google nu a confirmat sincronizarea. Datele sunt salvate în aplicație; poți reîncerca.";
  }
  const result = await db.rpc("crm_finish_sync", { p_id: id, p_token: token, p_version: claim.data.updatedAt, p_sync: status });
  if (result.error || result.data !== true) return { state: "pending", message: "Rezultatul sincronizării nu a fost confirmat. Reîncarcă agenda înainte să continui." };
  return status;
}
