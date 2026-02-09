const CACHE_NAME = 'fpv-goggle-viewer';
const CACHE_VERSION = 'v1';
const urlsToCache = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(`${CACHE_VERSION}-${CACHE_NAME}`).then((cache) => cache.addAll(urlsToCache)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.indexOf(CACHE_VERSION) !== 0)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  if (request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(`${CACHE_VERSION}-${CACHE_NAME}`).then((cache) => {
            cache.put(request, copy);
          });
          return response;
        })
        .catch(() => caches.match(request).then((response) => response || caches.match('/'))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((response) => response || fetch(request)),
  );
});
