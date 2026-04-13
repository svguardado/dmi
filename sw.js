/* ISP — Service Worker v1.0 */
const CACHE = 'isp-v1';
const ASSETS = [
  '/dmi/',
  '/dmi/index.html',
  'https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
];

/* ── Install: pre-cache core assets ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(ASSETS.map(url => cache.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

/* ── Activate: remove old caches ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: cache-first para assets, network-first para datos ── */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Firebase / Firestore — siempre red (no cachear datos en tiempo real)
  if (url.hostname.includes('firestore') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com') && url.pathname.includes('firestore')) {
    return;
  }

  // Google Fonts CSS — network-first con fallback caché
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // CDN libs (xlsx, jspdf, html2canvas) — cache-first
  if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'www.gstatic.com') {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  // App principal — network-first, fallback caché (funciona offline)
  if (url.pathname.startsWith('/dmi')) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request) || caches.match('/dmi/index.html'))
    );
  }
});
