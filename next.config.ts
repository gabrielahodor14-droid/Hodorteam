import type { NextConfig } from "next";
const config: NextConfig = {
  async rewrites() { return [{ source: "/offline", destination: "/offline.html" }]; },
  async headers() { return [{ source: "/:path*", headers: [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' https://accounts.google.com https://*.supabase.co; upgrade-insecure-requests" },
  ] }, { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] }]; },
};
export default config;
