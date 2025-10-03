const CACHE_NAME = "kairon-v2"; // Updated version to force a refresh
const FILES_TO_CACHE = [
  "/",
  "index.html",
  "style.css",
  "app.js",
  "/favicon_io/site.webmanifest",
  "/favicon_io/apple-touch-icon.png",
  "/favicon_io/favicon-32x32.png",
  "/favicon_io/favicon-16x16.png",
  "/favicon_io/android-chrome-512x512.png",
  "/favicon_io/android-chrome-192x192.png", 
];

// On install, cache the app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Opened cache");
      return cache.addAll(FILES_TO_CACHE);
    })
  );
});

// On fetch, serve from cache if it's a request for our app files
self.addEventListener("fetch", (event) => {
  // Only apply caching for requests on the same origin (our app)
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        // If the file is in the cache, serve it. Otherwise, fetch it.
        return response || fetch(event.request);
      })
    );
  }
  // For all other requests (like to api.quotable.io), do nothing and let the browser handle it normally.
});
