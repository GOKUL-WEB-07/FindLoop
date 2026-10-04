// Cache only a generic offline page; private API responses stay on the network.
const CACHE='findloop-offline-v2-'+self.registration.scope;
const OFFLINE=new URL('offline.html',self.registration.scope).href;
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.add(OFFLINE)));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('findloop-offline-')&&key.endsWith(self.registration.scope)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.mode==='navigate'&&event.request.url.startsWith(self.registration.scope)){
    event.respondWith(fetch(event.request).catch(()=>caches.match(OFFLINE)));
  }
});
