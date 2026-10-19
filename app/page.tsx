import { redirect } from "next/navigation";
import { identity } from "@/lib/supabase";
import { configured, required } from "@/lib/config";
import Workspace from "./workspace";
export const dynamic = "force-dynamic";
export default async function Home() {
  if (!configured()) redirect("/login");
  if (!await identity()) redirect("/login");
  return <Workspace sheetUrl={`https://docs.google.com/spreadsheets/d/${encodeURIComponent(required("GOOGLE_SHEET_ID"))}/edit`} />;
}
