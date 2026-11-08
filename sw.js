// Offline support. Bump VERSION when you change files so phones pick up the update.
const VERSION = "bunbites-v8";
const SCANNER = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
const SHELL = ["./", "index.html", "app.js", "foods.js", "manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(async c => {
    await c.addAll(SHELL);
    // pre-download the barcode scanner so the first scan works offline
    try { const r = await fetch(SCANNER, {mode: "cors"}); if (r.ok) await c.put(SCANNER, r); } catch (_) {}
  }));
  self.skipWaiting();
});
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.hostname.includes("openfoodfacts")) return; // always live
  // network first for our own files (so updates show up), cache fallback offline
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
    return;
  }
  // fonts + scanner library: cache after first use
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; })));
});
