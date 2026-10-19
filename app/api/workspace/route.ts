import { identity } from "@/lib/supabase";
import { syncRecord } from "@/lib/google";
import { clientSchema, viewingSchema } from "@/app/lib/validation";
import { apiResponse as response, assertSameOrigin, readJsonBody, RequestError } from "@/app/lib/http";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET() {
  try {
    const session = await identity(); if (!session) return response({ error: "Conectează-te pentru a vedea agenda." }, 401);
    const data: {kind:string;data:Record<string,unknown>;sync:unknown}[]=[];
    for(let offset=0;offset<=10000;offset+=1000){
      const result=await session.db.from("crm_records").select("kind,data,sync").eq("owner_id",session.user.id).order("row_no",{ascending:false}).range(offset,offset+999);
      if(result.error)return response({error:"Nu am putut încărca agenda."},500);
      data.push(...result.data);
      if(data.length>10000)return response({error:"Agenda depășește limita acestei versiuni. Contactează administratorul."},413);
      if(result.data.length<1000)break;
    }
    const items = data.map(row => ({ ...row.data, sync: row.sync, kind: row.kind }));
    return response({ clients: items.filter(i => i.kind === "client").map(({ kind, ...item }) => { void kind; return item; }), viewings: items.filter(i => i.kind === "viewing").map(({ kind, ...item }) => { void kind; return item; }) });
  } catch { return response({ error: "Conectarea aplicației nu este finalizată." }, 503); }
}
export async function POST(request: Request) { return mutate(request, false); }
export async function PATCH(request: Request) { return mutate(request, true); }
async function mutate(request: Request, editing: boolean) {
  try {
    assertSameOrigin(request);
    const session = await identity(); if (!session) return response({ error: "Sesiunea a expirat. Reconectează-te." }, 401);
    const body = await readJsonBody(request);
    const entity = z.enum(["client", "viewing"]).safeParse(body.entity);
    const id = z.string().uuid().safeParse(editing ? body.id : body.operationId);
    if (!entity.success || !id.success) return response({ error: "Identificator sau tip de înregistrare invalid." }, 400);
    if (editing && typeof body.expectedUpdatedAt !== "string") return response({ error: "Lipsește versiunea înregistrării." }, 400);
    const parsed = (entity.data === "client" ? clientSchema : viewingSchema).safeParse(body.data);
    if (!parsed.success) return response({ error: parsed.error.issues[0]?.message || "Verifică datele introduse." }, 400);
    const saved = await session.db.rpc("crm_save_record", { p_kind: entity.data, p_id: id.data, p_data: parsed.data, p_expected: editing ? body.expectedUpdatedAt : null });
    if (saved.error) {
      const status = saved.error.code === "42501" ? 403 : ["40001", "55P03", "23505"].includes(saved.error.code) ? 409 : saved.error.code === "P0002" ? 404 : 500;
      return response({ error: status === 500 ? "Nu am putut salva modificarea." : saved.error.message }, status);
    }
    const sync = await syncRecord(session.db, session.user.id, id.data);
    return response({ item: { ...saved.data, sync } }, editing ? 200 : 201);
  } catch (e) { if (e instanceof RequestError) return response({ error: e.message }, e.status); return response({ error: "Nu am putut confirma salvarea. Reîncarcă agenda înainte să continui." }, 500); }
}
