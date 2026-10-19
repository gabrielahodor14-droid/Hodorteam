export type SyncStatus={state:"pending"|"synced"|"error";sheets?:boolean;calendar?:boolean;message?:string;at?:string};
export const STAGES = [
  {id:"new",label:"Nou",short:"Clienți noi",color:"blue"},
  {id:"contacted",label:"Contactat",short:"Contactați",color:"purple"},
  {id:"searching",label:"În căutare",short:"În căutare",color:"amber"},
  {id:"viewing",label:"Vizionări",short:"La vizionări",color:"violet"},
  {id:"negotiating",label:"Negociere",short:"În negociere",color:"rose"},
  {id:"closed",label:"Încheiat",short:"Tranzacții încheiate",color:"green"},
  {id:"archived",label:"Arhivat",short:"Arhivați",color:"gray"},
] as const;
export const INTENTS:Record<string,string>={buy:"Cumpărare",rent:"Închiriere"};
export const TYPES:Record<string,string>={apartment:"Apartament",studio:"Garsonieră",house:"Casă / vilă",land:"Teren",commercial:"Spațiu comercial"};
export const PREFERENCES=["Aproape de metrou","Balcon / terasă","Loc de parcare","Acceptă animale","Centrală proprie","Mobilat","Lift","Spațiu verde"];
export type Client={sync?:SyncStatus;id:string;name:string;phone:string;email:string;intent:string;propertyType:string;budgetMin:number;budgetMax:number;currency:string;rooms:string;zones:string;preferences:string[];notes:string;source:string;priority:string;followUp:string;status:string;createdAt:string;updatedAt:string};
export type Viewing={sync?:SyncStatus;id:string;clientId:string;property:string;address:string;listingUrl:string;startsAt:string;duration:number;status:string;notes:string;createdAt:string;updatedAt:string};
export type WorkspaceData={clients:Client[];viewings:Viewing[]};
export const EMPTY_CLIENT={name:"",phone:"",email:"",intent:"buy",propertyType:"apartment",budgetMin:0,budgetMax:0,currency:"EUR",rooms:"",zones:"",preferences:[] as string[],notes:"",source:"",priority:"normal",followUp:"",status:"new"};
export const EMPTY_VIEWING={clientId:"",property:"",address:"",listingUrl:"",startsAt:"",duration:60,status:"scheduled",notes:""};
export function normalizeSearch(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("ro");}
export function matchesClient(c:Client,query:string){return normalizeSearch([c.name,c.phone,c.email,c.zones,c.notes,...c.preferences].join(" ")).includes(normalizeSearch(query.trim()));}
export function formatMoney(amount:number,currency="EUR"){return new Intl.NumberFormat("ro-RO",{maximumFractionDigits:0}).format(amount)+(currency==="EUR"?" €":" lei");}
export function budgetLabel(c:Pick<Client,"budgetMin"|"budgetMax"|"currency"|"intent">){
  const {budgetMin:min,budgetMax:max,currency,intent}=c;if(!min&&!max)return "Buget de stabilit";
  const value=min&&max?`${new Intl.NumberFormat("ro-RO").format(min)} – ${formatMoney(max,currency)}`:max?`Până la ${formatMoney(max,currency)}`:`De la ${formatMoney(min,currency)}`;
  return value+(intent==="rent"?" / lună":"");
}
export function dateKey(value:string|Date=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Bucharest",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));}
export function dateTimeInput(value:string|Date){return new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Bucharest",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(value)).replace(" ","T");}
export function bucharestToISO(value:string):string{
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error("Alege data și ora vizionării.");
  const target=Date.parse(value+":00Z");if(!Number.isFinite(target)||new Date(target).toISOString().slice(0,16)!==value)throw new Error("Data vizionării nu este validă.");
  let estimate=target;
  for(let i=0;i<3;i++){const local=Date.parse(dateTimeInput(new Date(estimate))+":00Z");const delta=target-local;if(delta===0)return new Date(estimate).toISOString();estimate+=delta;}
  if(dateTimeInput(new Date(estimate))!==value)throw new Error("Ora aleasă nu există la schimbarea orei. Alege altă oră.");
  return new Date(estimate).toISOString();
}
export function prettyDate(value:string,withYear=false){return new Intl.DateTimeFormat("ro-RO",{timeZone:"Europe/Bucharest",day:"numeric",month:"short",...(withYear?{year:"numeric"}:{})}).format(new Date(value.length===10?value+"T12:00:00Z":value));}
export function prettyTime(value:string){return new Intl.DateTimeFormat("ro-RO",{timeZone:"Europe/Bucharest",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(value));}
export function isActive(c:Client){return c.status!=="closed"&&c.status!=="archived";}
export function overlapping(viewings:Viewing[],start:string,duration:number,exceptId?:string){const from=Date.parse(start),to=from+duration*60000;return viewings.find(v=>v.id!==exceptId&&v.status==="scheduled"&&Date.parse(v.startsAt)<to&&Date.parse(v.startsAt)+v.duration*60000>from);}
export function calendarFile(v:Viewing,clientName:string){
  const escape=(s:string)=>s.replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
  const date=(n:number)=>new Date(n).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
  const fold=(line:string)=>{const encoder=new TextEncoder();const lines:string[]=[];let current="",length=0;for(const char of line){const bytes=encoder.encode(char).length;if(length+bytes>75){lines.push(current);current=" "+char;length=bytes+1;}else{current+=char;length+=bytes;}}lines.push(current);return lines.join("\r\n");};
  return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Hodor Estates//Agenda//RO","BEGIN:VEVENT",`UID:${v.id}@hodor-estates`,`DTSTAMP:${date(Date.now())}`,`DTSTART:${date(Date.parse(v.startsAt))}`,`DTEND:${date(Date.parse(v.startsAt)+v.duration*60000)}`,`STATUS:${v.status==="cancelled"?"CANCELLED":"CONFIRMED"}`,`SUMMARY:${escape("Vizionare · "+clientName+" · "+v.property)}`,`LOCATION:${escape(v.address)}`,`DESCRIPTION:${escape(v.notes)}`,"END:VEVENT","END:VCALENDAR",""].map(fold).join("\r\n");
}
export function csvFile(clients:Client[]){
  const cell=(v:unknown)=>{const s=String(v??"");return '"'+(/^[\u0000-\u0020]*[=+@-]/.test(s)||/^[\t\r\n]/.test(s)?"'":"")+s.replace(/"/g,'""')+'"';};
  const rows:unknown[][]=[["Nume","Telefon","Email","Interes","Tip proprietate","Buget minim","Buget maxim","Monedă","Camere","Zone","Preferințe","Stadiu","Prioritate","Revino la","Sursă","Notițe"]];
  for(const c of clients)rows.push([c.name,c.phone,c.email,INTENTS[c.intent],TYPES[c.propertyType],c.budgetMin,c.budgetMax,c.currency,c.rooms,c.zones,c.preferences.join(", "),STAGES.find(s=>s.id===c.status)?.label,c.priority==="high"?"Ridicată":"Normală",c.followUp,c.source,c.notes]);
  return "\uFEFF"+rows.map(row=>row.map(cell).join(";")).join("\r\n");
}
export function googleCalendarLink(v:Viewing,clientName:string){
  const stamp=(n:number)=>new Date(n).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
  const query=new URLSearchParams({action:"TEMPLATE",text:`Vizionare · ${clientName} · ${v.property}`,dates:`${stamp(Date.parse(v.startsAt))}/${stamp(Date.parse(v.startsAt)+v.duration*60000)}`,ctz:"Europe/Bucharest",location:v.address,details:[v.notes,v.listingUrl,"Hodor Estates"].filter(Boolean).join("\n\n")});
  return "https://calendar.google.com/calendar/render?"+query.toString();
}
export function viewingsCsvFile(viewings:Viewing[],clients:Client[]){
  const cell=(v:unknown)=>{const s=String(v??"");return '"'+(/^[\u0000-\u0020]*[=+@-]/.test(s)||/^[\t\r\n]/.test(s)?"'":"")+s.replace(/"/g,'""')+'"';};
  const rows:unknown[][]=[["ID vizionare","ID client","Client","Proprietate","Adresă","Data și ora București","Durată minute","Stare","Link anunț","Notițe"]];
  for(const v of viewings)rows.push([v.id,v.clientId,clients.find(c=>c.id===v.clientId)?.name||"",v.property,v.address,dateTimeInput(v.startsAt).replace("T"," "),v.duration,v.status==="completed"?"Efectuată":v.status==="cancelled"?"Anulată":"Programată",v.listingUrl,v.notes]);
  return "\uFEFF"+rows.map(row=>row.map(cell).join(";")).join("\r\n");
}
