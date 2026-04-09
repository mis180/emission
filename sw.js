const CACHE_NAME = 'ecocalc-v1.0.1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './workflow_ui.css',
  './app.js',
  './engine/project-store.js',
  './engine/wizard.js',
  './engine/evaluator.js',
  './engine/lookup.js',
  './engine/graph-resolver.js',
  './engine/composition.js',
  './engine/reportGenerator.js',
  './engine/geo-meteo-workspace.js',
  './engine/plume-screening.js',
  './ui/wizard-ui.js',
  './ui/project-ui.js',
  './ui/wind-rose.js',
  './ui/handbook-modal.js',
  './ui/validation-report-ui.js',
  './lib/math.min.js',
  './data/registry.json',
  './pwa_icon_192.png',
  './pwa_icon_512.png',
  './manifest.json'
];

// External assets to cache (Pinned CDNs)
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/@geoman-io/leaflet-geoman-free@2.14.2/dist/leaflet-geoman.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/@geoman-io/leaflet-geoman-free@2.14.2/dist/leaflet-geoman.min.js',
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
  'https://d3js.org/d3.v7.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching assets');
      return cache.addAll([...ASSETS_TO_CACHE, ...EXTERNAL_ASSETS]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Strategy: Network-First for data files (registry) to ensure updates
  if (url.pathname.endsWith('.json') || url.pathname.includes('/data/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clonedResponse));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Strategy: Stale-While-Revalidate for app shell and logic
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          // Do not cache opaque responses if you want to avoid cache pollution, but standard sw allows it.
          // Only cache valid responses. For no-cors, status is 0. 
          if (responseToCache.status === 200 || responseToCache.status === 0) {
              cache.put(event.request, responseToCache);
          }
        });
        return networkResponse;
      }).catch(err => {
        console.error('[SW] Fetch failed:', event.request.url, err);
        throw err;
      });
      return cachedResponse || fetchPromise;
    })
  );
});
