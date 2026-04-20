/* ============================================
   KWEZA SERVICE WORKER  v6 (cache bust)
   ============================================ */
const CACHE_NAME = 'kweza-invoice-v6';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/main.css',
  './css/components.css',
  './css/pages.css',
  './js/db.js',
  './js/auth.js',
  './js/app.js',
  './js/pdf.js',
  './js/share.js',
  './js/reminders.js',
  './js/pages/dashboard.js',
  './js/pages/clients.js',
  './js/pages/catalog.js',
  './js/pages/quotations.js',
  './js/pages/invoices.js',
  './js/pages/loans.js',
  './js/pages/settings.js',
  './assets/logo.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
  'https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js'
];

// Install: pre-cache all assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => cache.add(url).catch(err => console.warn('[SW] Could not cache:', url, err)))
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: delete ALL old caches, claim clients
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log('[SW] Deleting old cache:', k);
        return caches.delete(k);
      }))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for HTML/JS/CSS so updates always load; cache-first for images/fonts
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
  if (!isHttp) return;

  const isAsset = /\.(png|jpg|jpeg|svg|ico|woff2|woff)$/.test(url.pathname);
  const isExternal = url.origin !== self.location.origin;

  if (isAsset || isExternal) {
    // Cache-first for static assets & external CDN
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        }).catch(() => caches.match('./index.html'));
      })
    );
  } else {
    // Network-first for HTML/JS/CSS — always get latest code
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('./index.html');
        });
      })
    );
  }
});

// Background sync for reminders
self.addEventListener('periodicsync', event => {
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkReminders());
  }
});

async function checkReminders() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'CHECK_REMINDERS' }));
}
