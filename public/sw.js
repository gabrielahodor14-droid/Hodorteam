/* Cache only public application assets. Private pages, auth and API data never enter this cache. */
const CACHE="hodor-public-v2.0.0";
const PUBLIC=["/offline","/manifest.webmanifest","/favicon.svg","/icons/icon-192.png","/icons/icon-512.png","/icons/maskable-512.png","/icons/apple-touch-icon.png"];
const isPublic=url=>url.origin===self.location.origin&&(PUBLIC.includes(url.pathname)||/^\/_next\/static\/.+\.(?:js|css|woff2?)$/.test(url.pathname));
self.addEventListener("install",event=>{
  event.waitUntil((async()=>{const cache=await caches.open(CACHE);for(const path of PUBLIC){const response=await fetch(path,{cache:"reload",credentials:"same-origin"});if(!response.ok||response.redirected)throw new Error("Public asset unavailable");await cache.put(path,response);}await self.skipWaiting();})());
});
self.addEventListener("activate",event=>{event.waitUntil((async()=>{for(const key of await caches.keys()){if(key.startsWith("hodor-public-")&&key!==CACHE)await caches.delete(key);}await self.clients.claim();})());});
self.addEventListener("fetch",event=>{
  const request=event.request;if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith("/api/")||url.pathname.startsWith("/signin-with-chatgpt")||url.pathname.startsWith("/signout-with-chatgpt")||url.pathname==="/callback")return;
  if(request.mode==="navigate"){
    event.respondWith(fetch(request).catch(async()=>{const cached=await caches.match("/offline");return cached||new Response("Ești offline. Reconectează-te la internet pentru a deschide agenda.",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}});}));return;
  }
  if(!isPublic(url))return;
  event.respondWith((async()=>{const cache=await caches.open(CACHE);const existing=await cache.match(request);if(existing)return existing;const response=await fetch(request);const type=response.headers.get("content-type")||"";if(response.ok&&!response.redirected&&!type.includes("text/html"))await cache.put(request,response.clone());return response;})());
});
