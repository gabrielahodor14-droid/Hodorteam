import { required } from "./config";
import { eventBody, eventId, sheetData } from "./google-data";
import type { Client, Viewing } from "@/app/lib/model";
export type Sync = { state: "pending" | "synced" | "error"; sheets?: boolean; calendar?: boolean; message?: string; at?: string };
export type Claim = { kind: "client" | "viewing"; data: Client | Viewing; row: number; sync: Sync; client?: Client; generation: number };
export class UserSyncError extends Error {}

type GoogleEvent = { etag?: string; status?: string; extendedProperties?: { private?: { hodorId?: string; hodorOwner?: string } } };

export class GoogleApi {
  private deadline = Date.now() + 43_000;
  constructor(private token: string) {}
  async call<T>(url: string, method = "GET", body?: unknown, extra?: Record<string, string>): Promise<{ status: number; data: T }> {
    const remaining = this.deadline - Date.now();
    if (remaining < 500) throw new UserSyncError("Google nu a confirmat la timp. Datele sunt salvate în aplicație; poți reîncerca sincronizarea.");
    const response = await fetch(url, { method, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(Math.min(7000, remaining)), headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json", ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json().catch(() => null) as T;
    return { status: response.status, data };
  }
}
function check(status: number) {
  if (status >= 200 && status < 300) return;
  if (status === 401) throw new UserSyncError("Reconectează contul Google pentru a continua sincronizarea.");
  if (status === 403) throw new UserSyncError("Google a refuzat accesul. Verifică permisiunile pentru Sheets și Calendar.");
  if (status === 429) throw new UserSyncError("Google a limitat temporar cererile. Reîncearcă mai târziu.");
  throw new UserSyncError("Google nu a confirmat salvarea. Datele sunt păstrate în aplicație.");
}
export async function writeSheet(api: GoogleApi, claim: Claim) {
  const id = encodeURIComponent(required("GOOGLE_SHEET_ID"));
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${id}`;
  const { title, headers, values } = sheetData(claim.kind, claim.data, claim.client);
  if (!Number.isSafeInteger(claim.row) || claim.row < 2 || claim.row > 100_000) throw new UserSyncError("Fișierul Sheets a atins limita configurată de rânduri.");
  type Sheet = { sheetId: number; title: string; gridProperties: { rowCount: number; columnCount: number } };
  async function metadata() {
    const response = await api.call<{ sheets: { properties: Sheet }[] }>(`${base}?fields=sheets.properties`);
    check(response.status); return response.data.sheets.map(s => s.properties);
  }
  let sheet = (await metadata()).find(s => s.title === title);
  if (!sheet) {
    const created = await api.call(base + ":batchUpdate", "POST", { requests: [{ addSheet: { properties: { title, gridProperties: { rowCount: Math.max(1000, claim.row), columnCount: 20 } } } }] });
    if (created.status !== 400) check(created.status); // Another record may have created this tab concurrently.
    sheet = (await metadata()).find(s => s.title === title);
    if (!sheet) throw new UserSyncError("Nu am putut pregăti fila din Sheets.");
  }
  if (sheet.gridProperties.rowCount < claim.row || sheet.gridProperties.columnCount < headers.length) {
    const expanded = await api.call(base + ":batchUpdate", "POST", { requests: [{ updateSheetProperties: { properties: { sheetId: sheet.sheetId, gridProperties: { rowCount: Math.max(sheet.gridProperties.rowCount, claim.row), columnCount: Math.max(sheet.gridProperties.columnCount, headers.length) } }, fields: "gridProperties.rowCount,gridProperties.columnCount" } }] }); check(expanded.status);
  }
  const ranges = new URLSearchParams(); ranges.append("ranges", `'${title}'!A1:T1`); ranges.append("ranges", `'${title}'!A2:A${Math.max(sheet.gridProperties.rowCount,claim.row)}`);
  const existing = await api.call<{ valueRanges: { values?: string[][] }[] }>(`${base}/values:batchGet?${ranges}`); check(existing.status);
  const currentHeaders = existing.data.valueRanges[0]?.values?.[0];
  const ids=existing.data.valueRanges[1]?.values||[];
  const matches=ids.flatMap((row,index)=>row[0]===claim.data.id?[index+2]:[]);
  if(matches.length>1)throw new UserSyncError("Fișierul Sheets conține înregistrări duplicate. Sincronizarea necesită verificare.");
  const targetRow=matches[0]||claim.row;
  const currentId = ids[targetRow-2]?.[0];
  if (currentHeaders?.some((value, index) => value !== headers[index]) || currentId && currentId !== claim.data.id) throw new UserSyncError("Fișierul Sheets a fost reorganizat. Sincronizarea necesită verificare; datele sunt păstrate în aplicație.");
  const written = await api.call<{ totalUpdatedRows: number }>(base + "/values:batchUpdate", "POST", { valueInputOption: "RAW", data: [
    { range: `'${title}'!A1`, values: [headers] }, { range: `'${title}'!A${targetRow}`, values: [values] },
  ] }); check(written.status);
  if (written.data.totalUpdatedRows < 2) throw new UserSyncError("Google Sheets nu a confirmat ambele rânduri.");
}
export async function writeCalendar(api: GoogleApi, owner: string, claim: Claim) {
  const v = claim.data as Viewing;
  const id = eventId(owner, `${v.id}:${claim.generation}`);
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || "primary")}/events`;
  const url = `${base}/${id}`;
  const current = await api.call<GoogleEvent>(url);
  if (current.status === 404 || current.status === 410 || current.data?.status === "cancelled") {
    if (v.status === "cancelled") return;
    if (current.status === 410 || current.data?.status === "cancelled") throw new UserSyncError("Evenimentul a fost șters din Google. Verifică vizionarea înainte de a o programa din nou.");
    const body = { ...eventBody(owner, v, claim.client!), id };
    const created = await api.call<GoogleEvent>(`${base}?sendUpdates=none`, "POST", body);
    if (created.status !== 409) { check(created.status); return; }
    // A previous request may have created it before losing its response.
    const found = await api.call<GoogleEvent>(url); check(found.status);
    current.status = found.status; current.data = found.data;
  }
  check(current.status);
  if (current.data?.extendedProperties?.private?.hodorId !== v.id || current.data.extendedProperties.private.hodorOwner !== owner || !current.data.etag) throw new UserSyncError("Evenimentul Google nu poate fi identificat în siguranță.");
  if (v.status === "cancelled") {
    const removed = await api.call(`${url}?sendUpdates=none`, "DELETE", undefined, { "If-Match": current.data.etag });
    if (![404, 410].includes(removed.status)) check(removed.status); return;
  }
  const { id: unused, ...body } = eventBody(owner, v, claim.client!); void unused;
  const updated = await api.call(`${url}?sendUpdates=none`, "PATCH", body, { "If-Match": current.data.etag }); check(updated.status);
}
