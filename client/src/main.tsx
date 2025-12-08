import { createRoot } from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { reportWebVitals } from "./utils/perf";
import "./index.css";
import "./styles/nightOpsTheme.css";
import "./i18n/i18n";

// SP-23: Initialize performance monitoring
reportWebVitals();

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);

// Development mode detection
const isDevelopment = window.location.hostname === 'localhost' ||
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname.includes('.replit.dev');

// Service Worker management for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // In development mode, unregister any existing service workers to prevent caching issues
    if (isDevelopment) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.unregister().then(() => {
            console.log('[PWA] DEV MODE - Service Worker unregistered to prevent caching');
          });
        }
      });
      
      // Clear all caches in development mode
      if ('caches' in window) {
        caches.keys().then((cacheNames) => {
          cacheNames.forEach((cacheName) => {
            caches.delete(cacheName);
            console.log('[PWA] DEV MODE - Cache cleared:', cacheName);
          });
        });
      }
      
      console.log('[PWA] DEV MODE - Service Worker disabled for fresh reloads');
      return;
    }
    
    // In production mode, register service worker normally
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('[PWA] PRODUCTION - Service Worker registered successfully:', registration.scope);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available, prompt user to reload
                console.log('[PWA] New service worker available, please reload');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[PWA] Service Worker registration failed:', error);
      });
  });
}
