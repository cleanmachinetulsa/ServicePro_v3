// Cache version - increment to force update
const CACHE_NAME = 'comm-hub-v18-dev-bypass';

// Development mode detection - check if running on localhost or .replit.dev
const isDevelopment = () => {
  return self.location.hostname === 'localhost' ||
         self.location.hostname === '127.0.0.1' ||
         self.location.hostname.includes('.replit.dev') ||
         self.location.port === '5173' ||
         self.location.port === '5000';
};

// URLs to cache on install (only in production)
const urlsToCache = [
  '/',
  '/messages',
  '/index.html',
  '/manifest.json',
];

// Dashboard data endpoints that use cache-first strategy (only in production)
const DASHBOARD_ENDPOINTS = [
  '/api/dashboard',
  '/api/appointments',
  '/api/customers'
];

// Offline mutation queue (stored in memory)
let offlineQueue = [];

// Install service worker and cache app shell
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  
  // Skip caching in development mode
  if (isDevelopment()) {
    console.log('[ServiceWorker] DEVELOPMENT MODE - Skipping cache installation');
    return self.skipWaiting();
  }
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[ServiceWorker] Installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[ServiceWorker] Installation failed:', error);
      })
  );
});

// Activate service worker and clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  
  // In development mode, clear ALL caches to prevent stale data
  if (isDevelopment()) {
    console.log('[ServiceWorker] DEVELOPMENT MODE - Clearing all caches');
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('[ServiceWorker] Deleting cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }).then(() => {
        console.log('[ServiceWorker] All caches cleared in development mode');
        return self.clients.claim();
      })
    );
    return;
  }
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[ServiceWorker] Activated successfully');
      return self.clients.claim();
    })
  );
});

// Fetch strategy: Smart caching based on resource type
self.addEventListener('fetch', (event) => {
  // DEVELOPMENT MODE: Never cache, always fetch fresh
  if (isDevelopment()) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          console.log('[ServiceWorker] DEV MODE - Fresh fetch:', event.request.url);
          return response;
        })
        .catch(error => {
          console.error('[ServiceWorker] DEV MODE - Fetch failed:', error);
          return new Response('Network error in development mode', { 
            status: 503,
            statusText: 'Service Unavailable' 
          });
        })
    );
    return;
  }
  
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Only cache GET requests
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Check if this is a dashboard data endpoint - use cache-first strategy
  const isDashboardEndpoint = DASHBOARD_ENDPOINTS.some(endpoint => 
    event.request.url.includes(endpoint)
  );

  if (isDashboardEndpoint) {
    console.log('[ServiceWorker] Cache-first strategy for:', event.request.url);
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[ServiceWorker] Serving from cache:', event.request.url);
            // Return cached response immediately, but update cache in background
            fetch(event.request)
              .then((freshResponse) => {
                if (freshResponse && freshResponse.status === 200) {
                  caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, freshResponse.clone());
                    console.log('[ServiceWorker] Updated cache for:', event.request.url);
                  });
                }
              })
              .catch(() => {
                console.log('[ServiceWorker] Background update failed, using cached data');
              });
            return cachedResponse;
          }
          // No cache available, fetch from network
          return fetch(event.request)
            .then((response) => {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
              return response;
            });
        })
    );
    return;
  }

  // For other API requests, always try network first
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone the response before caching
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Return cached response if network fails
          return caches.match(event.request);
        })
    );
    return;
  }

  // For static assets, try cache first then network
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        });
      })
  );
});

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (!event.data) return;

  const { type, data } = event.data;

  // Handle skip waiting for service worker updates
  if (type === 'SKIP_WAITING') {
    console.log('[ServiceWorker] Skip waiting requested');
    self.skipWaiting();
    return;
  }

  // Handle badge updates using the Badge API
  if (type === 'SET_BADGE') {
    console.log('[ServiceWorker] Setting badge count:', data?.count);
    if ('setAppBadge' in navigator) {
      const count = data?.count || 0;
      if (count > 0) {
        navigator.setAppBadge(count)
          .then(() => console.log('[ServiceWorker] Badge set to:', count))
          .catch(err => console.error('[ServiceWorker] Badge API error:', err));
      } else {
        navigator.clearAppBadge()
          .then(() => console.log('[ServiceWorker] Badge cleared'))
          .catch(err => console.error('[ServiceWorker] Badge clear error:', err));
      }
    } else {
      console.log('[ServiceWorker] Badge API not supported');
    }
    return;
  }

  // Handle queuing mutations for offline sync
  if (type === 'QUEUE_MUTATION') {
    console.log('[ServiceWorker] Queuing mutation for offline sync:', data);
    offlineQueue.push({
      id: Date.now(),
      timestamp: new Date().toISOString(),
      data: data
    });
    console.log('[ServiceWorker] Offline queue size:', offlineQueue.length);
    
    // Register a sync event if supported
    if ('sync' in self.registration) {
      self.registration.sync.register('sync-mutations')
        .then(() => console.log('[ServiceWorker] Sync registered for mutations'))
        .catch(err => console.error('[ServiceWorker] Sync registration failed:', err));
    }
    
    // Notify client that mutation was queued
    event.ports[0]?.postMessage({ 
      success: true, 
      queued: true,
      queueSize: offlineQueue.length 
    });
    return;
  }
});

// Push notification event handler
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received:', event);
  
  let data = {
    title: 'New Message',
    body: 'You have a new message',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    tag: 'default-notification',
    data: {}
  };
  
  try {
    if (event.data) {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag || data.tag,
        data: payload.data || data.data
      };
    }
  } catch (error) {
    console.error('[ServiceWorker] Error parsing push payload:', error);
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      data: data.data,
      requireInteraction: false,
      vibrate: [200, 100, 200]
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification clicked:', event.notification);
  
  event.notification.close();
  
  // Navigate to relevant page based on notification data
  const urlToOpen = event.notification.data?.url || '/messages';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus().then(() => client.navigate(urlToOpen));
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background Sync event handler
// Syncs dashboard data and processes offline queue when connection is restored
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync event triggered:', event.tag);
  
  if (event.tag === 'sync-dashboard') {
    console.log('[ServiceWorker] Syncing dashboard data...');
    event.waitUntil(
      Promise.all([
        // Fetch and cache dashboard data
        fetch('/api/dashboard').then(res => {
          if (res.ok) {
            return caches.open(CACHE_NAME).then(cache => {
              cache.put('/api/dashboard', res.clone());
              console.log('[ServiceWorker] Dashboard data synced');
            });
          }
        }).catch(err => console.error('[ServiceWorker] Dashboard sync failed:', err)),
        
        // Fetch and cache appointments
        fetch('/api/appointments').then(res => {
          if (res.ok) {
            return caches.open(CACHE_NAME).then(cache => {
              cache.put('/api/appointments', res.clone());
              console.log('[ServiceWorker] Appointments synced');
            });
          }
        }).catch(err => console.error('[ServiceWorker] Appointments sync failed:', err)),
        
        // Fetch and cache customers
        fetch('/api/customers').then(res => {
          if (res.ok) {
            return caches.open(CACHE_NAME).then(cache => {
              cache.put('/api/customers', res.clone());
              console.log('[ServiceWorker] Customers synced');
            });
          }
        }).catch(err => console.error('[ServiceWorker] Customers sync failed:', err))
      ])
    );
  }
  
  if (event.tag === 'sync-mutations') {
    console.log('[ServiceWorker] Processing offline mutation queue...');
    console.log('[ServiceWorker] Queue size:', offlineQueue.length);
    
    event.waitUntil(
      processOfflineQueue()
        .then(() => {
          console.log('[ServiceWorker] Offline queue processed successfully');
          // Notify clients that sync completed
          return self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({ 
                type: 'SYNC_COMPLETED',
                tag: 'sync-mutations',
                success: true 
              });
            });
          });
        })
        .catch(err => {
          console.error('[ServiceWorker] Queue processing failed:', err);
        })
    );
  }
});

// Helper function to process offline mutation queue
async function processOfflineQueue() {
  if (offlineQueue.length === 0) {
    console.log('[ServiceWorker] Offline queue is empty');
    return;
  }
  
  const results = [];
  
  for (const mutation of offlineQueue) {
    try {
      console.log('[ServiceWorker] Processing queued mutation:', mutation.id);
      
      // Attempt to send the mutation to the server
      const response = await fetch(mutation.data.url, {
        method: mutation.data.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...mutation.data.headers
        },
        body: JSON.stringify(mutation.data.body)
      });
      
      if (response.ok) {
        console.log('[ServiceWorker] Mutation processed successfully:', mutation.id);
        results.push({ id: mutation.id, success: true });
      } else {
        console.error('[ServiceWorker] Mutation failed:', mutation.id, response.status);
        results.push({ id: mutation.id, success: false, error: response.status });
      }
    } catch (error) {
      console.error('[ServiceWorker] Error processing mutation:', mutation.id, error);
      results.push({ id: mutation.id, success: false, error: error.message });
    }
  }
  
  // Remove successfully processed mutations from queue
  offlineQueue = offlineQueue.filter(mutation => {
    const result = results.find(r => r.id === mutation.id);
    return result && !result.success;
  });
  
  console.log('[ServiceWorker] Remaining queue size after processing:', offlineQueue.length);
  return results;
}

// Periodic Background Sync event handler
// Updates weather and calendar data periodically (requires permission)
self.addEventListener('periodicsync', (event) => {
  console.log('[ServiceWorker] Periodic sync event triggered:', event.tag);
  
  if (event.tag === 'update-weather') {
    console.log('[ServiceWorker] Updating weather data...');
    event.waitUntil(
      fetch('/api/weather')
        .then(res => {
          if (res.ok) {
            return caches.open(CACHE_NAME).then(cache => {
              cache.put('/api/weather', res.clone());
              console.log('[ServiceWorker] Weather data updated');
              
              // Notify clients about weather update
              return self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                  client.postMessage({ 
                    type: 'WEATHER_UPDATED',
                    timestamp: new Date().toISOString() 
                  });
                });
              });
            });
          }
        })
        .catch(err => console.error('[ServiceWorker] Weather update failed:', err))
    );
  }
  
  if (event.tag === 'update-calendar') {
    console.log('[ServiceWorker] Updating calendar data...');
    event.waitUntil(
      fetch('/api/appointments')
        .then(res => {
          if (res.ok) {
            return caches.open(CACHE_NAME).then(cache => {
              cache.put('/api/appointments', res.clone());
              console.log('[ServiceWorker] Calendar data updated');
              
              // Notify clients about calendar update
              return self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                  client.postMessage({ 
                    type: 'CALENDAR_UPDATED',
                    timestamp: new Date().toISOString() 
                  });
                });
              });
            });
          }
        })
        .catch(err => console.error('[ServiceWorker] Calendar update failed:', err))
    );
  }
});
