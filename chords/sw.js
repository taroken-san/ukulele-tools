// ウクレレコード帳 Service Worker
// 方針: HTMLはネット優先(更新が古いまま残らない)／オフライン時はキャッシュで動く
// アイコン等の静的物はキャッシュ優先。VERSIONを上げると古いキャッシュを破棄する。
const VERSION = 'v1';
const CACHE = 'ukechords-' + VERSION;
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ネット優先(3秒でキャッシュにフォールバック)。成功時は裏でキャッシュも更新
function netFirst(req) {
  const net = fetch(req).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
    return res;
  });
  return new Promise(resolve => {
    let settled = false;
    const finish = r => { if (!settled) { settled = true; resolve(r); } };
    const timer = setTimeout(() => {
      caches.match(req).then(r => { if (r) finish(r); });
    }, 3000);
    net.then(res => { clearTimeout(timer); finish(res); })
       .catch(() => {
         clearTimeout(timer);
         caches.match(req).then(r => finish(r || new Response(
           'オフラインです。一度オンラインで開くと、次からはオフラインでも使えます。',
           { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
         )));
       });
  });
}

function cacheFirst(req) {
  return caches.match(req).then(r => r || fetch(req).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
    return res;
  }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  e.respondWith(isHTML ? netFirst(req) : cacheFirst(req));
});
