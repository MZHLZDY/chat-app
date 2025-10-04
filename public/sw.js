// Service Worker untuk Push Notifications Panggilan
const CACHE_NAME = 'call-notifications-v1';
const urlsToCache = [
  '/',
  '/images/phone-icon.png',
  '/images/badge-72x72.png'
];

// Install Event - Cache resources penting
self.addEventListener('install', (event) => {
  console.log('🛠️ Service Worker installed');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up cache lama
self.addEventListener('activate', (event) => {
  console.log('🎯 Service Worker activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Push Event - Handle incoming push notifications
self.addEventListener('push', function(event) {
  console.log('📨 Push event received');
  
  if (!event.data) {
    console.warn('⚠️ Push event but no data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('📊 Push data:', data);

    const options = {
      body: data.body,
      icon: data.icon || '/images/phone-icon.png',
      badge: '/images/badge-72x72.png',
      tag: data.tag || 'incoming-call',
      requireInteraction: true, // Tetap terbuka sampai user action
      actions: data.actions || [
        {
          action: 'accept',
          title: '🎉 Terima'
        },
        {
          action: 'reject', 
          title: '❌ Tolak'
        }
      ],
      data: data.data || {}
    };

    console.log('🔄 Showing notification with options:', options);

    event.waitUntil(
      self.registration.showNotification(data.title || 'Panggilan Masuk', options)
        .then(() => console.log('✅ Notification shown successfully'))
        .catch(error => console.error('❌ Error showing notification:', error))
    );

  } catch (error) {
    console.error('❌ Error processing push event:', error);
    
    // Fallback notification jika parsing JSON gagal
    const fallbackOptions = {
      body: 'Klik untuk membuka aplikasi',
      icon: '/images/phone-icon.png',
      tag: 'fallback-notification',
      requireInteraction: true
    };

    event.waitUntil(
      self.registration.showNotification('Panggilan Masuk', fallbackOptions)
    );
  }
});

// Notification Click Event - Handle ketika notifikasi diklik
self.addEventListener('notificationclick', function(event) {
  console.log('🎯 Notification clicked:', event.notification.tag);
  
  event.notification.close();

  const notificationData = event.notification.data || {};
  const action = event.action;

  console.log('🔍 Notification data:', notificationData);
  console.log('🎯 Action clicked:', action);

  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then(function(windowClients) {
    console.log('🔍 Found window clients:', windowClients.length);

    // Cari tab yang sudah terbuka dengan aplikasi kita
    let matchingClient = null;
    for (let i = 0; i < windowClients.length; i++) {
      const windowClient = windowClients[i];
      if (windowClient.url.includes('/chat') || windowClient.url.includes(window.location.origin)) {
        matchingClient = windowClient;
        break;
      }
    }

    if (matchingClient) {
      console.log('🎯 Focusing existing tab');
      return matchingClient.focus().then(() => {
        // Kirim message ke client tentang action notifikasi
        if (action) {
          matchingClient.postMessage({
            type: 'NOTIFICATION_ACTION',
            action: action,
            callId: notificationData.callId,
            callType: notificationData.callType,
            channel: notificationData.channel
          });
        }
        return matchingClient;
      });
    } else {
      console.log('🆕 Opening new tab');
      return clients.openWindow(notificationData.url || '/')
        .then(newClient => {
          if (newClient && action) {
            // Tunggu sedikit lalu kirim message
            setTimeout(() => {
              newClient.postMessage({
                type: 'NOTIFICATION_ACTION', 
                action: action,
                callId: notificationData.callId,
                callType: notificationData.callType,
                channel: notificationData.channel
              });
            }, 1000);
          }
          return newClient;
        });
    }
  });

  event.waitUntil(promiseChain);
});

// Message Event - Handle messages dari main thread
self.addEventListener('message', (event) => {
  console.log('📩 Message received in SW:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background Sync untuk reliability (opsional)
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync:', event.tag);
  if (event.tag === 'call-notification-sync') {
    // Handle background sync untuk notifikasi
  }
});