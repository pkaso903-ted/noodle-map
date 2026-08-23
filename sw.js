var CACHE = 'noodlemap-v6';
var ASSETS = ['./','./index.html','./styles.css','./app.js','./config.js','./data.json','./ratings.json','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install', function(e){ self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS).catch(function(){}); })); });
self.addEventListener('activate', function(e){ e.waitUntil(caches.keys().then(function(ks){ return Promise.all(ks.map(function(k){ return k===CACHE?null:caches.delete(k); })); }).then(function(){ return self.clients.claim(); })); });
self.addEventListener('fetch', function(e){
  var u = new URL(e.request.url);
  if(e.request.method!=='GET') return;
  if(u.origin!==location.origin) return;
  e.respondWith(
    fetch(e.request).then(function(res){ var cp=res.clone(); caches.open(CACHE).then(function(c){ c.put(e.request, cp); }); return res; })
    .catch(function(){ return caches.match(e.request).then(function(r){ return r || caches.match('./index.html'); }); })
  );
});