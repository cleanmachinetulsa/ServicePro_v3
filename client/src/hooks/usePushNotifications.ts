import { useState, useEffect } from 'react';

interface PushNotificationState {
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    permission: 'default',
    isSubscribed: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    if (!('Notification' in window)) {
      console.log('[Push] Notifications not supported in this browser');
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Notifications not supported' 
      }));
      return;
    }

    if (!('serviceWorker' in navigator)) {
      console.log('[Push] Service Worker not supported in this browser');
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Service Worker not supported' 
      }));
      return;
    }

    try {
      const currentPermission = Notification.permission;
      console.log('[Push] Current browser notification permission:', currentPermission);
      
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      console.log('[Push] Existing subscription:', subscription ? 'Found' : 'None');
      
      setState({
        permission: currentPermission,
        isSubscribed: !!subscription,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('[Push] Error checking subscription:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Failed to check subscription status' 
      }));
    }
  };

  const subscribe = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        setState(prev => ({ 
          ...prev, 
          permission, 
          isLoading: false,
          error: 'Notification permission denied' 
        }));
        return false;
      }

      // Get VAPID public key from server
      const vapidResponse = await fetch('/api/push/vapid-public-key', {
        credentials: 'include',
      });
      
      if (!vapidResponse.ok) {
        throw new Error('Failed to get VAPID public key');
      }

      const { publicKey } = await vapidResponse.json();

      // Subscribe to push notifications
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Send subscription to server
      const subscribeResponse = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
          auth: arrayBufferToBase64(subscription.getKey('auth')),
          userAgent: navigator.userAgent,
        }),
      });

      if (!subscribeResponse.ok) {
        throw new Error('Failed to save subscription');
      }

      setState({
        permission: 'granted',
        isSubscribed: true,
        isLoading: false,
        error: null,
      });

      return true;
    } catch (error: any) {
      console.error('[Push] Subscription error:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error.message || 'Failed to subscribe' 
      }));
      return false;
    }
  };

  const unsubscribe = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: 'No active subscription' 
        }));
        return false;
      }

      // Unsubscribe on server
      await fetch('/api/push/unsubscribe', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: subscription.endpoint,
        }),
      });

      // Unsubscribe locally
      await subscription.unsubscribe();

      setState({
        permission: Notification.permission,
        isSubscribed: false,
        isLoading: false,
        error: null,
      });

      return true;
    } catch (error: any) {
      console.error('[Push] Unsubscribe error:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error.message || 'Failed to unsubscribe' 
      }));
      return false;
    }
  };

  const sendTestNotification = async () => {
    try {
      const response = await fetch('/api/push/test', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to send test notification');
      }

      return true;
    } catch (error: any) {
      console.error('[Push] Test notification error:', error);
      return false;
    }
  };

  return {
    ...state,
    subscribe,
    unsubscribe,
    sendTestNotification,
    refresh: checkSubscriptionStatus,
  };
}

// Helper functions
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
