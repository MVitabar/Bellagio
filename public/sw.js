// public/sw.js
const CACHE_NAME = 'comandero-v1';
const urlsToCache = [
  '/',
  '/login',
  '/register',
  '/dashboard',
  '/invitation/register',
  '/invitation/accept',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.png',
  '/favicon.ico',
  '/static/css/',
  '/static/js/'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(urlsToCache);
    })
  );
  // Forzar la activación inmediata
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Activar el nuevo service worker inmediatamente
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Si encontramos una coincidencia en el cache, la devolvemos
      if (response) {
        return response;
      }

      // Si no hay coincidencia, hacemos la petición a la red
      return fetch(event.request).then((response) => {
        // Verificar si la respuesta es válida
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clonar la respuesta ya que se va a usar tanto en el cache como en el navegador
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      });
    })
  );
});

self.addEventListener('message', (event) => {
});

self.addEventListener('push', (event) => {
});

// Eliminados console.log innecesarios
