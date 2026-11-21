/* Programme de fond de l'application : la rend installable (bureau du Mac ou du PC, écran d'accueil du téléphone) et
   affiche les notifications. L'app se charge toujours depuis le site, à jour ; seule la page « hors connexion » est gardée. */
// Seule la page « hors connexion » (et ce qu'elle affiche) est gardée : quand le réseau manque, elle remplace l'erreur
// du navigateur. Tout le reste vient toujours du site.
var RESERVE = 'hors-ligne-1', PAGES = ['hors-ligne.html', 'assets/polices/polices.css', 'assets/polices/geist-normal-latin.woff2',
  'assets/polices/bodoni-moda-normal-latin.woff2', 'assets/marque/logo.svg', 'assets/marque/logo-clair.svg'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(RESERVE).then(function (c) { return c.addAll(PAGES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (cles) {
    return Promise.all(cles.filter(function (k) { return k !== RESERVE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).catch(function () { return caches.match('hors-ligne.html'); }));
    return;
  }
  // Ressources de la page hors connexion : réseau d'abord, réserve si le réseau manque
  if (new URL(r.url).origin === self.location.origin && PAGES.some(function (p) { return r.url.indexOf(p) >= 0; }) && !/[?]v=/.test(r.url)) {
    e.respondWith(fetch(r).catch(function () { return caches.match(r, { ignoreSearch: true }); }));
  }
});
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { corps: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titre || 'Studio Lili', {
    body: d.corps || '', icon: 'assets/marque/icone-192.png', badge: 'assets/marque/icone-192.png', tag: d.tag || 'studio-' + Date.now(), data: { url: d.url || './' }
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (fen) {
    for (var i = 0; i < fen.length; i++) if ('focus' in fen[i]) { if ('navigate' in fen[i]) fen[i].navigate(url).catch(function () {}); return fen[i].focus(); }
    return self.clients.openWindow(url);
  }));
});
