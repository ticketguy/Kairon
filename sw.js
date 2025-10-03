// Define a name for our cache
const CACHE_NAME = "kairon-v1";

// List the files we want to cache
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

// When the service worker is installed, open the cache and add the core files
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Opened cache");
      return cache.addAll(FILES_TO_CACHE);
    })
  );
});

// When the app makes a request (e.g., for a file), serve it from the cache if possible
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // If the file is in the cache, serve it. Otherwise, fetch it from the network.
      return response || fetch(event.request);
    })
  );
});
