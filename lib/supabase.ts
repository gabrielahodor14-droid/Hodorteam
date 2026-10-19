import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { required } from "./config";

export async function userDb() {
  const jar = await cookies();
  return createServerClient(required("SUPABASE_URL"), required("SUPABASE_PUBLISHABLE_KEY"), {
    cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) { try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch { /* Proxy refreshes cookies before Server Components. */ } },
    },
  });
}
export async function identity() {
  const db = await userDb();
  const { data: { user }, error } = await db.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (error || !user || !user.email_confirmed_at || email !== required("ALLOWED_EMAIL").toLowerCase() || !user.identities?.some(i => i.provider === "google" && i.identity_data?.email_verified === true)) return null;
  return { db, user };
}
