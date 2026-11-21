/* Programme de fond de l'application : la rend installable (bureau du Mac ou du PC, écran d'accueil du téléphone) et
   affichera les notifications. Ne garde aucune page en mémoire : l'app se charge toujours depuis le site, à jour. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () { /* rien : le réseau répond */ });
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
