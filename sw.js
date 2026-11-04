// 小羊樂園：先用網路取得最新版，沒網路時用快取（上課時網路不穩也能打開）
const CACHE='llm-v103';
const FILES=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./favicon-48.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  const req=e.request.mode==='navigate'?new Request(e.request.url,{cache:'no-cache',credentials:'same-origin'}):e.request.headers.has('range')?e.request:new Request(e.request,{cache:'no-cache'});
  e.respondWith(fetch(req).then(r=>{const c=r.clone();if(r.status===200)caches.open(CACHE).then(x=>x.put(e.request,c)).catch(()=>{});return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
