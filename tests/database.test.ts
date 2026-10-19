import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {EMPTY_CLIENT} from '../app/lib/model';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const cid='11111111-1111-4111-8111-111111111111',vid='22222222-2222-4222-8222-222222222222',lock='33333333-3333-4333-8333-333333333333';
test('Postgres authorization, idempotency, edit conflicts and sync lifecycle',async t=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;grant usage on schema auth,public to authenticated;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;
 insert into auth.users values('${owner}','gabrielahodor14@gmail.com',now()),('${other}','second@example.com',now());`);
 const files=(await readdir('supabase/migrations')).filter(x=>x.endsWith('.sql'));
 for(const file of files)await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 await db.exec("insert into crm_private.crm_members values('second@example.com');set role authenticated;");
 async function as(id:string){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
 async function save(id:string,kind:string,data:unknown,expected:string|null=null){const r=await db.query<{data:any}>("select public.crm_save_record($1,$2,$3::jsonb,$4) as data",[kind,id,JSON.stringify(data),expected]);return r.rows[0].data;}
 const client={...EMPTY_CLIENT,name:'Test Owner'};
 await as(owner);let c:any;let v:any;
 await t.test('same create operation returns one original record',async()=>{c=await save(cid,'client',client);const again=await save(cid,'client',client);assert.equal(c.createdAt,again.createdAt);const rows=await db.query('select * from public.crm_records');assert.equal(rows.rows.length,1);await assert.rejects(save(cid,'client',{...client,name:'Conflicting'}));});
 await t.test('another permitted account cannot read, edit or associate this client',async()=>{await as(other);assert.equal((await db.query('select * from public.crm_records')).rows.length,0);await assert.rejects(save(cid,'client',client));await assert.rejects(save(vid,'viewing',{clientId:cid}));await as(owner);});
 const viewing={clientId:cid,property:'Apartment',address:'',listingUrl:'',startsAt:'2026-10-20T10:00:00.000Z',duration:60,status:'scheduled',notes:''};
 await t.test('viewing requires an owned client and retains a stable external row',async()=>{v=await save(vid,'viewing',viewing);const first=await db.query<{row_no:number}>('select row_no from public.crm_records where id=$1',[vid]);await save(vid,'viewing',viewing);assert.equal((await db.query<{row_no:number}>('select row_no from public.crm_records where id=$1',[vid])).rows[0].row_no,first.rows[0].row_no);});
 await t.test('sync lock blocks edits and unrelated completion tokens',async()=>{const claimed=await db.query<{claim:any}>('select public.crm_claim_sync($1,$2) as claim',[vid,lock]);assert.equal(claimed.rows[0].claim.client.name,client.name);await assert.rejects(save(vid,'viewing',{...viewing,notes:'Changed'},v.updatedAt));await assert.rejects(save(cid,'client',{...client,name:'Changed'},c.updatedAt));const wrong=await db.query<{done:boolean}>("select public.crm_finish_sync($1,$2,$3,'{\"state\":\"synced\"}') as done",[vid,cid,v.updatedAt]);assert.equal(wrong.rows[0].done,false);await db.query("select public.crm_finish_sync($1,$2,$3,'{\"state\":\"synced\"}')",[vid,lock,v.updatedAt]);});
 await t.test('cancel then reschedule advances Calendar generation to avoid reusing a tombstone',async()=>{v=await save(vid,'viewing',{...viewing,status:'cancelled'},v.updatedAt);v=await save(vid,'viewing',viewing,v.updatedAt);const rows=await db.query<{calendar_generation:number}>('select calendar_generation from public.crm_records where id=$1',[vid]);assert.equal(rows.rows[0].calendar_generation,1);await assert.rejects(save(vid,'viewing',{...viewing,notes:'Stale'},'old-version'));});
 await t.test('table writes and Google credentials are inaccessible through user permissions',async()=>{await assert.rejects(db.query("update public.crm_records set owner_id=$1 where id=$2",[other,cid]));assert.equal((await db.query('select * from public.crm_google_connections')).rows.length,0);await assert.rejects(db.query('select * from crm_private.crm_members'));await as('');await assert.rejects(save('44444444-4444-4444-8444-444444444444','client',client));assert.equal((await db.query('select * from public.crm_records')).rows.length,0);});
 }finally{await db.close();}
});
