import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface PwaContextType {
  isOnline: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  canShare: boolean;
  unreadCount: number;
  promptInstall: () => Promise<void>;
  shareContent: (data: ShareData) => Promise<void>;
  updateBadge: (count: number) => void;
  clearBadge: () => void;
  queueMutation: (mutation: QueuedMutation) => void;
  requestPersistentStorage: () => Promise<boolean>;
}

interface QueuedMutation {
  url: string;
  method: string;
  data: any;
  timestamp: number;
}

const PwaContext = createContext<PwaContextType | null>(null);

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error('usePwa must be used within PwaProvider');
  }
  return context;
}

interface PwaProviderProps {
  children: ReactNode;
}

export function PwaProvider({ children }: PwaProviderProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Check if app is installed
  useEffect(() => {
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIosStandalone = (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone || isIosStandalone);
    };
    
    checkInstalled();
    window.matchMedia('(display-mode: standalone)').addEventListener('change', checkInstalled);
    
    return () => {
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', checkInstalled);
    };
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('[PWA] App is online');
      
      // Trigger background sync when coming online
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then((registration: any) => {
          registration.sync.register('sync-mutations').catch((error: Error) => {
            console.error('[PWA] Failed to register sync:', error);
          });
        });
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      console.log('[PWA] App is offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      console.log('[PWA] Install prompt available');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Listen for app installed event
  useEffect(() => {
    const handleAppInstalled = () => {
      console.log('[PWA] App installed successfully');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Prompt user to install app
  const promptInstall = async () => {
    if (!deferredPrompt) {
      console.log('[PWA] No install prompt available');
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`[PWA] User ${outcome === 'accepted' ? 'accepted' : 'dismissed'} install prompt`);
    
    if (outcome === 'accepted') {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  // Share content using Web Share API
  const shareContent = async (data: ShareData) => {
    if (!navigator.share) {
      throw new Error('Web Share API not supported');
    }

    try {
      await navigator.share(data);
      console.log('[PWA] Content shared successfully');
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('[PWA] Share failed:', error);
        throw error;
      }
    }
  };

  // Update app icon badge
  const updateBadge = (count: number) => {
    setUnreadCount(count);
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.active?.postMessage({
          type: 'SET_BADGE',
          count
        });
      });
    }
  };

  // Clear app icon badge
  const clearBadge = () => {
    updateBadge(0);
  };

  // Queue mutation for offline processing
  const queueMutation = (mutation: QueuedMutation) => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.active?.postMessage({
          type: 'QUEUE_MUTATION',
          data: mutation
        });
      });
    }
  };

  // Request persistent storage
  const requestPersistentStorage = async (): Promise<boolean> => {
    if (!navigator.storage || !navigator.storage.persist) {
      console.warn('[PWA] Persistent storage not supported');
      return false;
    }

    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) {
      console.log('[PWA] Storage is already persistent');
      return true;
    }

    const granted = await navigator.storage.persist();
    console.log(`[PWA] Persistent storage ${granted ? 'granted' : 'denied'}`);
    return granted;
  };

  const value: PwaContextType = {
    isOnline,
    isInstallable,
    isInstalled,
    canShare: typeof navigator.share !== 'undefined',
    unreadCount,
    promptInstall,
    shareContent,
    updateBadge,
    clearBadge,
    queueMutation,
    requestPersistentStorage,
  };

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}
