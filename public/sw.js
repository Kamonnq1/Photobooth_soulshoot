self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil((async () => {
    const wins = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.some(c => c.visibilityState === 'visible') && d.tag !== 'soulshoot-test') return; // เปิดหน้าอยู่ → มีแบนเนอร์ในหน้าแล้ว
    await self.registration.showNotification(d.title || 'SOULSHOOT', {
      body: d.body, tag: d.tag, icon: '/icon.png', badge: '/icon.png',
      vibrate: d.vibrate ? [200, 100, 200, 100, 400] : undefined, data: { url: d.url || '/' } });
  })());
});
self.addEventListener('notificationclick', e => { // กดแล้วพาเข้า Moment นั้นตรงๆ
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(clients.matchAll({ type: 'window' }).then(l => l.length ? l[0].focus().then(c => c.navigate(url)) : clients.openWindow(url)));
});
