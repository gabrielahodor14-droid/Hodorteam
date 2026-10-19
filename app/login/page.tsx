import { redirect } from "next/navigation";
import { userDb, identity } from "@/lib/supabase";
import { appOrigin, configured } from "@/lib/config";
export const dynamic = "force-dynamic";
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ready = configured();
  if (ready && await identity()) redirect("/");
  const params = await searchParams;
  async function login() {
    "use server";
    if (!configured()) return;
    const db = await userDb();
    const { data, error } = await db.auth.signInWithOAuth({ provider: "google", options: {
      redirectTo: `${appOrigin()}/auth/callback`,
      scopes: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/calendar.events.owned",
      queryParams: { access_type: "offline", prompt: "consent" },
    } });
    if (error || !data.url) redirect("/login?error=connection");
    redirect(data.url);
  }
  return <main className="login-page"><section className="login-card"><img src="/icons/icon-192.png" alt="" width="64" height="64" /><p className="eyebrow">HODOR ESTATES</p><h1>Agenda ta imobiliară.</h1><p>Clienți, preferințe și vizionări, mereu la îndemână.</p>{!ready ? <p role="status">Aplicația este în curs de configurare. Revino la versiunea actuală până la finalizarea conectării.</p> : <><form action={login}><button className="button primary" type="submit">Continuă cu Google</button></form>{params.error && <p role="alert">Conectarea nu s-a finalizat. Folosește contul Google autorizat și acordă accesul la Sheets și Calendar.</p>}</>}</section></main>;
}
