// sw.js
const CACHE_NAME = 'musicflow-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/main.js',
    '/js/auth.js',
    '/js/db.js',
    '/js/equalizer.js',
    '/js/player.js',
    '/js/state.js',
    '/js/supabase.js',
    '/js/ui.js',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Não cacheia requisições do Supabase ou blob de aúdio
    if (url.origin.includes('supabase.co') || url.protocol === 'blob:') {
        return;
    }

    // Stale-While-Revalidate para o site
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (event.request.method === 'GET') {
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Fallback silencioso (retorna o cache que já foi entregue se der erro)
            });

            return cachedResponse || fetchPromise;
        })
    );
});
