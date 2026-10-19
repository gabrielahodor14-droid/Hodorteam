export function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Lipsește configurarea ${name}.`);
  return value;
}
export function appOrigin() {
  const url = new URL(required("APP_URL"));
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")) throw new Error("APP_URL trebuie să folosească HTTPS.");
  return url.origin;
}
export function configured() {
  return ["APP_URL", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "ALLOWED_EMAIL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_SHEET_ID", "APP_ENCRYPTION_KEY"].every(name => !!process.env[name]?.trim());
}
