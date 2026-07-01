const CACHE = 'gl-v6';
const DATA_CACHE = 'gl-data-v1'; // 数据备份缓存，永久保留
const ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      // 只删旧的 app 缓存，DATA_CACHE 永远保留
      const oldCaches = keys.filter(k => k !== CACHE && k !== DATA_CACHE);
      const isUpdate = oldCaches.length > 0;
      return Promise.all(oldCaches.map(k => caches.delete(k))).then(() => {
        if (isUpdate) {
          return self.clients.matchAll({ type: 'window' }).then(clients => {
            clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
          });
        }
      });
    })
  );
  self.clients.claim();
});

// Network-first: 优先联网，离线时回退缓存（只缓存同域 app 资源，不拦截 Supabase API）
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // 跳过外部 API 请求
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
