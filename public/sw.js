// Service worker: only shows push notifications. It deliberately caches nothing,
// so a deploy is live immediately and there's no cache version to bump.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch (_) {}
  // iOS requires every push to show a notification.
  e.waitUntil(self.registration.showNotification(d.title || 'Roundnet Taiwan', {
    body: d.body || '',
    tag: d.tag,
    renotify: !!d.tag,
    data: { url: d.url || '/' },
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data.url, self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => c.url === url);
    return open ? open.focus() : self.clients.openWindow(url);
  }));
});
