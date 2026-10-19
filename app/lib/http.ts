export class RequestError extends Error {
  constructor(message:string,public status:number){super(message);}
}
export function apiResponse(data:unknown,status=200){
  return Response.json(data,{status,headers:{"Cache-Control":"private, no-store","Pragma":"no-cache","Vary":"Cookie","X-Content-Type-Options":"nosniff"}});
}
export function assertSameOrigin(request:Request){
  const origin=request.headers.get("origin");
  if((origin&&origin!==new URL(request.url).origin)||request.headers.get("sec-fetch-site")==="cross-site")throw new RequestError("Solicitare nepermisă.",403);
}
export async function readJsonBody(request:Request,limit=50_000):Promise<Record<string,unknown>>{
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||""))throw new RequestError("Trimite datele în format JSON.",415);
  if(Number(request.headers.get("content-length")||0)>limit)throw new RequestError("Datele sunt prea mari.",413);
  const reader=request.body?.getReader();if(!reader)throw new RequestError("Lipsesc datele de salvat.",400);
  const decoder=new TextDecoder();let size=0,text="";
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new RequestError("Datele sunt prea mari.",413);}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
  finally{reader.releaseLock();}
  let value:unknown;try{value=JSON.parse(text);}catch{throw new RequestError("Datele JSON nu sunt valide.",400);}
  if(!value||typeof value!=="object"||Array.isArray(value))throw new RequestError("Date invalide.",400);
  return value as Record<string,unknown>;
}
