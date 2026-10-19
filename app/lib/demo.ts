import {EMPTY_CLIENT,bucharestToISO,dateKey,type WorkspaceData} from "./model";
export function makeDemo():WorkspaceData{
  const now=new Date().toISOString();const day=(offset:number)=>dateKey(new Date(Date.now()+offset*86400000));
  const base={...EMPTY_CLIENT,createdAt:now,updatedAt:now};
  return {clients:[
    {...base,id:"demo-1",name:"Andreea Popescu",intent:"buy",budgetMin:95000,budgetMax:120000,rooms:"2",zones:"Aviației, Floreasca",preferences:["Aproape de metrou","Loc de parcare"],status:"viewing",priority:"high",followUp:day(0),source:"Recomandare",notes:"Exemplu fictiv · Își dorește lumină naturală și acces rapid la metrou. Finanțare prin credit ipotecar."},
    {...base,id:"demo-2",name:"Mihai Ionescu",intent:"rent",budgetMin:500,budgetMax:700,rooms:"2",zones:"Tineretului, Timpuri Noi",preferences:["Acceptă animale","Balcon / terasă","Mobilat"],status:"searching",followUp:day(1),source:"Instagram",notes:"Exemplu fictiv · Caută un apartament în care să se poată muta luna viitoare."},
    {...base,id:"demo-3",name:"Elena Dumitrescu",intent:"buy",propertyType:"house",budgetMin:180000,budgetMax:230000,rooms:"4",zones:"Pipera, Voluntari",preferences:["Spațiu verde","Loc de parcare"],status:"negotiating",priority:"high",followUp:day(1),source:"Site",notes:"Exemplu fictiv · Familie cu doi copii, caută grădină și apropiere de școală."},
    {...base,id:"demo-4",name:"Vlad Marinescu",intent:"rent",propertyType:"studio",budgetMax:400,rooms:"1",zones:"Grozăvești, Politehnica",preferences:["Mobilat","Aproape de metrou"],status:"new",source:"TikTok"},
    {...base,id:"demo-5",name:"Ioana Radu",intent:"buy",budgetMin:70000,budgetMax:90000,rooms:"2",zones:"Titan, Dristor",preferences:["Balcon / terasă","Lift"],status:"contacted",followUp:day(2),source:"Telefon"},
    {...base,id:"demo-6",name:"Radu și Ana Pavel",intent:"buy",budgetMax:145000,rooms:"3",zones:"Bucureștii Noi",preferences:["Loc de parcare"],status:"closed",source:"Recomandare"},
  ],viewings:[
    {id:"demo-v1",clientId:"demo-1",property:"Apartament luminos · 2 camere",address:"Strada Căpitan Alexandru Șerbănescu, Aviației",listingUrl:"",startsAt:bucharestToISO(day(1)+"T10:30"),duration:45,status:"scheduled",notes:"Exemplu fictiv · Întâlnire la intrarea în bloc.",createdAt:now,updatedAt:now},
    {id:"demo-v2",clientId:"demo-3",property:"Casă cu grădină · 4 camere",address:"Pipera, Voluntari",listingUrl:"",startsAt:bucharestToISO(day(1)+"T14:00"),duration:60,status:"scheduled",notes:"Exemplu fictiv · A doua vizionare, împreună cu familia.",createdAt:now,updatedAt:now},
    {id:"demo-v3",clientId:"demo-2",property:"Apartament cu balcon · 2 camere",address:"Bulevardul Tineretului, București",listingUrl:"",startsAt:bucharestToISO(day(2)+"T17:30"),duration:30,status:"scheduled",notes:"Exemplu fictiv · De verificat condițiile pentru animale.",createdAt:now,updatedAt:now},
  ]};
}
