import { createHash } from "node:crypto";
import { INTENTS, TYPES, STAGES, dateTimeInput, type Client, type Viewing } from "@/app/lib/model";
export function eventId(owner: string, id: string) { return createHash("sha256").update(`${owner}:${id}`).digest("hex"); }
export function eventBody(owner: string, v: Viewing, c: Client) {
  return { id: eventId(owner, v.id), summary: `Vizionare · ${c.name} · ${v.property}`, location: v.address,
    description: [`Client: ${c.name}`, c.phone && `Telefon: ${c.phone}`, c.email && `Email: ${c.email}`, v.notes, v.listingUrl, "Hodor Estates"].filter(Boolean).join("\n"),
    start: { dateTime: v.startsAt, timeZone: "Europe/Bucharest" },
    end: { dateTime: new Date(Date.parse(v.startsAt) + v.duration * 60000).toISOString(), timeZone: "Europe/Bucharest" },
    extendedProperties: { private: { hodorId: v.id, hodorOwner: owner } },
  };
}
export function sheetData(kind: "client" | "viewing", item: Client | Viewing, client?: Client) {
  if (kind === "client") {
    const c = item as Client;
    return { title: "Hodor_Clienti", headers: ["ID", "Nume", "Telefon", "Email", "Interes", "Tip proprietate", "Buget minim", "Buget maxim", "Monedă", "Camere", "Zone", "Preferințe", "Stadiu", "Prioritate", "Revenire", "Sursă", "Notițe", "Actualizat"],
      values: [c.id, c.name, c.phone, c.email, INTENTS[c.intent], TYPES[c.propertyType], c.budgetMin, c.budgetMax, c.currency, c.rooms, c.zones, c.preferences.join(", "), STAGES.find(s => s.id === c.status)?.label || c.status, c.priority, c.followUp, c.source, c.notes, c.updatedAt] };
  }
  const v = item as Viewing;
  return { title: "Hodor_Vizionari", headers: ["ID", "ID client", "Client", "Telefon", "Email", "Proprietate", "Adresă", "Data și ora București", "Durată minute", "Stare", "Link", "Notițe", "Actualizat"],
    values: [v.id, v.clientId, client?.name || "", client?.phone || "", client?.email || "", v.property, v.address, dateTimeInput(v.startsAt).replace("T", " "), v.duration, v.status, v.listingUrl, v.notes, v.updatedAt] };
}
