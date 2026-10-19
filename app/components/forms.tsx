"use client";

import {useEffect,useId,useRef,useState,type ReactNode,type FormEvent} from "react";
import {ArrowRight,Check,Clock3,LoaderCircle,MapPin,UserRound,X,AlertCircle} from "lucide-react";
import {EMPTY_CLIENT,EMPTY_VIEWING,INTENTS,PREFERENCES,STAGES,TYPES,bucharestToISO,dateTimeInput,overlapping,prettyTime,type Client,type Viewing} from "../lib/model";
import {clientSchema,viewingSchema} from "../lib/validation";

export type ClientDraft=typeof EMPTY_CLIENT;
export type ViewingDraft=typeof EMPTY_VIEWING;

export function Dialog({title,eyebrow,children,onClose,drawer=false}:{title:string;eyebrow?:string;children:ReactNode;onClose:()=>void;drawer?:boolean}){
  const ref=useRef<HTMLDivElement>(null);const titleId=useId();
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    ref.current?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    const handler=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){e.preventDefault();onClose();}
      if(e.key==="Tab"){
        const list=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')||[]).filter(el=>el.getClientRects().length);
        const first=list[0],last=list.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    };
    document.addEventListener("keydown",handler);return()=>{document.body.style.overflow=overflow;document.removeEventListener("keydown",handler);previous?.focus();};
  },[onClose]);
  return <div className={`dialog-backdrop ${drawer?"is-drawer":""}`}><div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
    <div className="dialog-header"><div>{eyebrow&&<span className="eyebrow">{eyebrow}</span>}<h2 id={titleId}>{title}</h2></div><button className="icon-button" aria-label="Închide fereastra" onClick={onClose}><X size={21}/></button></div>
    {children}
  </div></div>;
}
function Field({label,children,wide=false,hint}:{label:string;children:ReactNode;wide?:boolean;hint?:string}){
  return <label className={`field ${wide?"field-wide":""}`}><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;
}
function FormError({message}:{message:string}){return message?<div className="form-error" role="alert"><AlertCircle size={17}/>{message}</div>:null;}

export function ClientForm({client,onSave,onClose,saving}:{client?:Client;onSave:(data:ClientDraft,operationId:string)=>Promise<void>;onClose:()=>void;saving:boolean}){
  const [operationId]=useState(()=>crypto.randomUUID());
  const [form,setForm]=useState<ClientDraft>({...EMPTY_CLIENT,...client});const [error,setError]=useState("");
  function set<K extends keyof ClientDraft>(key:K,value:ClientDraft[K]){setForm(previous=>({...previous,[key]:value}));}
  async function submit(event:FormEvent){event.preventDefault();if(saving)return;setError("");const result=clientSchema.safeParse(form);if(!result.success){setError(result.error.issues[0].message);return;}try{await onSave(result.data,operationId);}catch(e){setError(e instanceof Error?e.message:"Nu am putut salva clientul.");}}
  return <Dialog title={client?"Editează clientul":"Client nou"} eyebrow={client?"FIȘĂ CLIENT":"ADAUGĂ UN CLIENT"} onClose={onClose}>
    <form onSubmit={submit} className="editor-form">
      <div className="dialog-body">
        <div className="form-section-title"><UserRound size={17}/><h3>Date de contact</h3><span>01</span></div>
        <div className="fields-grid">
          <Field label="Nume și prenume *" wide><input required minLength={2} maxLength={120} autoComplete="name" placeholder="Ex. Andreea Popescu" value={form.name} onChange={e=>set("name",e.target.value)}/></Field>
          <Field label="Telefon"><input type="tel" autoComplete="tel" maxLength={40} placeholder="07xx xxx xxx" value={form.phone} onChange={e=>set("phone",e.target.value)}/></Field>
          <Field label="Email"><input type="email" autoComplete="email" maxLength={180} placeholder="nume@exemplu.ro" value={form.email} onChange={e=>set("email",e.target.value)}/></Field>
        </div>
        <div className="form-section-title"><MapPin size={17}/><h3>Ce își dorește</h3><span>02</span></div>
        <div className="intent-switch" aria-label="Tipul tranzacției">{Object.entries(INTENTS).map(([key,label])=><button type="button" className={form.intent===key?"selected":""} key={key} onClick={()=>set("intent",key)}>{label}{form.intent===key&&<Check size={15}/>}</button>)}</div>
        <div className="fields-grid">
          <Field label="Tip de proprietate"><select value={form.propertyType} onChange={e=>set("propertyType",e.target.value)}>{Object.entries(TYPES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></Field>
          <Field label="Număr de camere"><select value={form.rooms} onChange={e=>set("rooms",e.target.value)}><option value="">Oricâte / de stabilit</option>{["1","2","3","4","5+"].map(n=><option key={n} value={n}>{n} {n==="1"?"cameră":"camere"}</option>)}</select></Field>
          <div className="budget-fields field-wide"><Field label={form.intent==="rent"?"Buget minim / lună":"Buget minim"}><input inputMode="decimal" type="number" min={0} max={1000000000} step="any" placeholder="De la" value={form.budgetMin||""} onChange={e=>set("budgetMin",Number(e.target.value))}/></Field><Field label={form.intent==="rent"?"Buget maxim / lună":"Buget maxim"}><input inputMode="decimal" type="number" min={0} max={1000000000} step="any" placeholder="Până la" value={form.budgetMax||""} onChange={e=>set("budgetMax",Number(e.target.value))}/></Field><Field label="Monedă"><select value={form.currency} onChange={e=>set("currency",e.target.value)}><option value="EUR">EUR €</option><option value="RON">RON lei</option></select></Field></div>
          <Field label="Zone preferate" wide><input maxLength={500} placeholder="Ex. Aviației, Floreasca, Pipera" value={form.zones} onChange={e=>set("zones",e.target.value)}/></Field>
        </div>
        <div className="field"><span>Preferințe</span><div className="preference-options">{PREFERENCES.map(p=><button type="button" key={p} aria-pressed={form.preferences.includes(p)} className={form.preferences.includes(p)?"selected":""} onClick={()=>set("preferences",form.preferences.includes(p)?form.preferences.filter(x=>x!==p):[...form.preferences,p])}>{form.preferences.includes(p)?<Check size={13}/>:<span className="small-plus">+</span>}{p}</button>)}</div></div>
        <div className="form-section-title"><Clock3 size={17}/><h3>Următorul pas</h3><span>03</span></div>
        <div className="fields-grid">
          <Field label="Stadiul clientului"><select value={form.status} onChange={e=>set("status",e.target.value)}>{STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
          <Field label="Prioritate"><select value={form.priority} onChange={e=>set("priority",e.target.value)}><option value="normal">Normală</option><option value="high">Ridicată</option></select></Field>
          <Field label="Revino la client pe"><input type="date" value={form.followUp} onChange={e=>set("followUp",e.target.value)}/></Field>
          <Field label="De unde vă cunoașteți"><select value={form.source} onChange={e=>set("source",e.target.value)}><option value="">Alege sursa</option>{["Recomandare","Telefon","Instagram","TikTok","Facebook","Site","Portal imobiliar","Prospectare","Altă sursă"].map(s=><option key={s}>{s}</option>)}</select></Field>
          <Field label="Notițe și alte preferințe" wide><textarea rows={3} maxLength={6000} placeholder="Ce contează pentru acest client? Termen de mutare, finanțare, cerințe speciale…" value={form.notes} onChange={e=>set("notes",e.target.value)}/></Field>
        </div><FormError message={error}/>
      </div>
      <div className="dialog-footer"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Renunță</button><button className="button primary" disabled={saving}>{saving?<LoaderCircle className="spin" size={17}/>:<Check size={17}/>} {saving?"Se salvează…":"Salvează clientul"}</button></div>
    </form>
  </Dialog>;
}

export function ViewingForm({viewing,initialClientId,clients,viewings,onSave,onClose,saving}:{viewing?:Viewing;initialClientId?:string;clients:Client[];viewings:Viewing[];onSave:(data:ViewingDraft,operationId:string)=>Promise<void>;onClose:()=>void;saving:boolean}){
  const [operationId]=useState(()=>crypto.randomUUID());
  const [form,setForm]=useState<ViewingDraft>(()=>({...EMPTY_VIEWING,clientId:initialClientId||"",startsAt:dateTimeInput(new Date(Date.now()+3600000)).slice(0,14)+"00",...viewing,...(viewing?{startsAt:dateTimeInput(viewing.startsAt)}:{})}));
  const [error,setError]=useState("");
  function set<K extends keyof ViewingDraft>(key:K,value:ViewingDraft[K]){setForm(previous=>({...previous,[key]:value}));}
  let conflict:Viewing|undefined;try{if(form.startsAt&&form.status==="scheduled")conflict=overlapping(viewings,bucharestToISO(form.startsAt),form.duration,viewing?.id);}catch{}
  async function submit(e:FormEvent){e.preventDefault();if(saving)return;setError("");try{const data={...form,startsAt:bucharestToISO(form.startsAt)};const result=viewingSchema.safeParse(data);if(!result.success){setError(result.error.issues[0].message);return;}await onSave(result.data,operationId);}catch(e){setError(e instanceof Error?e.message:"Nu am putut salva vizionarea.");}}
  return <Dialog title={viewing?"Detaliile vizionării":"Vizionare nouă"} eyebrow={viewing?"EDITEAZĂ VIZIONAREA":"PROGRAMEAZĂ O VIZIONARE"} onClose={onClose}>
    <form onSubmit={submit} className="editor-form"><div className="dialog-body">
      <div className="fields-grid">
        <Field label="Client *" wide><select required value={form.clientId} onChange={e=>set("clientId",e.target.value)}><option value="">Alege clientul</option>{[...clients].sort((a,b)=>a.name.localeCompare(b.name,"ro")).filter(c=>c.status!=="archived"||c.id===form.clientId).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Proprietate *" wide><input required minLength={2} maxLength={200} placeholder="Ex. Apartament 2 camere · Aviației" value={form.property} onChange={e=>set("property",e.target.value)}/></Field>
        <Field label="Adresă" wide><input maxLength={500} placeholder="Stradă, număr, bloc, apartament" value={form.address} onChange={e=>set("address",e.target.value)}/></Field>
        <Field label="Data și ora *" hint="Ora României · București"><input type="datetime-local" required value={form.startsAt} onChange={e=>set("startsAt",e.target.value)}/></Field>
        <Field label="Durată"><select value={form.duration} onChange={e=>set("duration",Number(e.target.value))}>{[15,30,45,60,90,120,180,240].map(n=><option key={n} value={n}>{n} de minute</option>)}</select></Field>
        <Field label="Linkul anunțului" wide><input type="url" maxLength={2000} placeholder="https://…" value={form.listingUrl} onChange={e=>set("listingUrl",e.target.value)}/></Field>
        <Field label="Starea vizionării" wide><select value={form.status} onChange={e=>set("status",e.target.value)}><option value="scheduled">Programată</option><option value="completed">Efectuată</option><option value="cancelled">Anulată</option></select></Field>
        <Field label="Notițe / feedback după vizionare" wide><textarea rows={4} maxLength={6000} placeholder="Acces în proprietate, persoană de contact, impresiile clientului, următorul pas…" value={form.notes} onChange={e=>set("notes",e.target.value)}/></Field>
      </div>
      {conflict&&<div className="form-warning"><AlertCircle size={17}/><span>Se suprapune cu „{conflict.property}”, de la {prettyTime(conflict.startsAt)}. Poți ajusta ora sau salva în continuare.</span></div>}
      <FormError message={error}/>
    </div><div className="dialog-footer"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Renunță</button><button className="button primary" disabled={saving}>{saving?<LoaderCircle className="spin" size={17}/>:<ArrowRight size={17}/>} {saving?"Se salvează…":viewing?"Salvează modificările":"Programează vizionarea"}</button></div></form>
  </Dialog>;
}
