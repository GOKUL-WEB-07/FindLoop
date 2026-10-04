// Cache only a generic offline page; private API responses stay on the network.
const CACHE='findloop-offline-v1';
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.add('/offline.html')));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('findloop-offline-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.mode==='navigate'&&new URL(event.request.url).origin===self.location.origin){
    event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));
  }
});
