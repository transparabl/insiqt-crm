// Service worker for Insiqt kontrollsenter: bare push-varsler, ingen mellomlagring av sider.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: e.data ? e.data.text() : 'Insiqt' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Insiqt kontrollsenter', {
    body: d.body || '', tag: d.tag || undefined, data: { url: d.url || '/kontroll.html' },
    icon: '/brand/app-icon-192.png', badge: '/brand/app-icon-192.png', lang: 'nb'
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/kontroll.html', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.includes('/kontroll.html')) { c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
