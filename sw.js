const CACHE_NAME='pilche-lab-cache-v2.2';
const CORE=['./','./index.html','./styles.css?v=2.2','./hangul-ink.js?v=2.2','./sample-ink.js?v=2.2','./digital-guide.js?v=2.2','./vendor/ttf-writer.js','./font-export.js?v=2.2','./app.js?v=2.2','./manifest.webmanifest','./icon-192.png','./icon-512.png','./손글씨_가이드용지_3장.pdf'];
self.addEventListener('install', event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('pilche-lab-cache-')&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin || !req.url.startsWith(self.registration.scope))return;
 if(req.mode==='navigate'){
   event.respondWith(fetch(req).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(c=>c.put(req,copy));}return response;}).catch(()=>caches.match(req).then(hit=>hit||caches.match('./index.html'))));return;
 }
 event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(c=>c.put(req,copy));}return response;})));
});
