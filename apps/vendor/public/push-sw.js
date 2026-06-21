// Service worker for support web-push notifications.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'New message', body: event.data && event.data.text ? event.data.text() : '' }; }
  const title = data.title || 'New support message';
  const options = {
    body: data.body || '',
    tag: data.ticketId ? ('ticket-' + data.ticketId) : undefined,
    renotify: true,
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if ('focus' in client) { try { await client.navigate(url); } catch (e) {} return client.focus(); }
    }
    if (clients.openWindow) return clients.openWindow(url);
  })());
});
