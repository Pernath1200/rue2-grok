/**
 * Bump CACHE_VERSION whenever this file changes so stale caches are dropped on activate.
 */
var CACHE_VERSION = 'v64';  // v64 - per-question "Review the lesson" links: stable intro section ids + in-quiz lesson modal
var CACHE_NAME = 'rue2-' + CACHE_VERSION;

var PRECACHE_URLS = [
  './',
  './index.html',
  './js/app.js',
  './icon.svg',
  './pwa-manifest.json'
];

function isJsonUrl(url) {
  return url.pathname.toLowerCase().endsWith('.json');
}

function isHtmlJsCss(url, request) {
  var p = url.pathname.toLowerCase();
  if (p.endsWith('.html') || p.endsWith('.js') || p.endsWith('.css')) return true;
  if (request.mode === 'navigate') return true;
  if (p === '/' || p === '/index.html') return true;
  return false;
}

function isImageUrl(url) {
  return /\.(png|jpe?g|gif|webp|svg|ico|avif|bmp)$/i.test(url.pathname);
}

function isFontUrl(url) {
  return /\.(woff2?|ttf|otf|eot)$/i.test(url.pathname);
}

function networkFirst(request) {
  return fetch(request)
    .then(function(response) {
      if (response && response.ok && response.type !== 'opaque') {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(request, clone);
        });
      }
      return response;
    })
    .catch(function() {
      return caches.match(request);
    });
}

function cacheFirst(request) {
  return caches.match(request).then(function(cached) {
    if (cached) return cached;
    return fetch(request).then(function(response) {
      if (response && response.ok && response.type !== 'opaque') {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(request, clone);
        });
      }
      return response;
    });
  });
}

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(k) {
            return k !== CACHE_NAME;
          })
          .map(function(k) {
            return caches.delete(k);
          })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  if (isJsonUrl(url)) {
    e.respondWith(
      fetch(e.request).then(function(response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(e.request, clone);
        });
        return response;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }

  if (isImageUrl(url) || isFontUrl(url)) {
    e.respondWith(cacheFirst(e.request));
    return;
  }

  if (isHtmlJsCss(url, e.request)) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  e.respondWith(networkFirst(e.request));
});
