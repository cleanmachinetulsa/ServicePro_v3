/**
 * Portal Install Prompt Hook
 * 
 * Extends the base PwaContext with tenant-configurable triggers,
 * cooldown logic, and event logging.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePwa } from '@/contexts/PwaContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

type InstallTrigger = 'booking_confirmed' | 'first_login' | 'loyalty_earned' | 'page_visit' | 'manual_only';

interface InstallPromptStatus {
  success: boolean;
  shouldShow: boolean;
  reason?: string;
  trigger?: InstallTrigger;
  bannerText?: string;
  buttonText?: string;
  cooldownDays?: number;
  cooldownEnds?: string;
}

interface UsePortalInstallPromptOptions {
  tenantId?: string;
  enabled?: boolean;
}

function generateDeviceFingerprint(): string {
  const existing = localStorage.getItem('portal_device_fingerprint');
  if (existing) return existing;
  
  const fingerprint = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  localStorage.setItem('portal_device_fingerprint', fingerprint);
  return fingerprint;
}

export function usePortalInstallPrompt(options: UsePortalInstallPromptOptions = {}) {
  const { enabled = true } = options;
  const pwa = usePwa();
  const [showBanner, setShowBanner] = useState(false);
  const [triggerEvent, setTriggerEvent] = useState<InstallTrigger | null>(null);
  const pageVisitCountRef = useRef(0);
  const hasLoggedShownRef = useRef(false);
  
  const deviceFingerprint = generateDeviceFingerprint();

  const { data: promptStatus, isLoading: statusLoading } = useQuery<InstallPromptStatus>({
    queryKey: ['/api/portal/install-prompt-status', deviceFingerprint],
    queryFn: async () => {
      const res = await fetch(`/api/portal/install-prompt-status?deviceFingerprint=${encodeURIComponent(deviceFingerprint)}`);
      return res.json();
    },
    enabled: enabled && !pwa.isInstalled,
    staleTime: 60000,
  });

  const logEventMutation = useMutation({
    mutationFn: async ({ event, trigger, metadata }: { event: string; trigger?: string; metadata?: Record<string, any> }) => {
      return apiRequest('/api/portal/install-prompt-log', {
        method: 'POST',
        body: JSON.stringify({
          event,
          trigger,
          deviceFingerprint,
          metadata,
        }),
      });
    },
  });

  const logEvent = useCallback((event: 'shown' | 'dismissed' | 'accepted' | 'installed', metadata?: Record<string, any>) => {
    logEventMutation.mutate({
      event,
      trigger: triggerEvent || undefined,
      metadata,
    });
  }, [logEventMutation, triggerEvent]);

  const checkTrigger = useCallback((trigger: InstallTrigger) => {
    if (pwa.isInstalled) return false;
    if (!promptStatus?.shouldShow) return false;
    if (promptStatus?.trigger === 'manual_only') return false;
    if (promptStatus?.trigger !== trigger) return false;
    
    return true;
  }, [pwa.isInstalled, promptStatus]);

  const fireBookingConfirmed = useCallback(() => {
    if (checkTrigger('booking_confirmed')) {
      setTriggerEvent('booking_confirmed');
      setShowBanner(true);
    }
  }, [checkTrigger]);

  const fireFirstLogin = useCallback(() => {
    if (checkTrigger('first_login')) {
      setTriggerEvent('first_login');
      setShowBanner(true);
    }
  }, [checkTrigger]);

  const fireLoyaltyEarned = useCallback(() => {
    if (checkTrigger('loyalty_earned')) {
      setTriggerEvent('loyalty_earned');
      setShowBanner(true);
    }
  }, [checkTrigger]);

  const firePageVisit = useCallback((threshold: number = 3) => {
    pageVisitCountRef.current += 1;
    if (pageVisitCountRef.current >= threshold && checkTrigger('page_visit')) {
      setTriggerEvent('page_visit');
      setShowBanner(true);
    }
  }, [checkTrigger]);

  const showManualPrompt = useCallback(() => {
    if (pwa.isInstalled) return;
    if (!pwa.isInstallable) return;
    
    setTriggerEvent('manual_only');
    setShowBanner(true);
  }, [pwa.isInstalled, pwa.isInstallable]);

  const dismissBanner = useCallback(() => {
    if (showBanner && !hasLoggedShownRef.current) {
      logEvent('dismissed');
    }
    setShowBanner(false);
    hasLoggedShownRef.current = false;
  }, [showBanner, logEvent]);

  const acceptInstall = useCallback(async () => {
    logEvent('accepted');
    try {
      await pwa.promptInstall();
    } catch (error) {
      console.log('[PortalInstallPrompt] Install cancelled or failed');
    }
    setShowBanner(false);
    hasLoggedShownRef.current = false;
  }, [pwa, logEvent]);

  useEffect(() => {
    if (showBanner && pwa.isInstallable && !hasLoggedShownRef.current) {
      logEvent('shown');
      hasLoggedShownRef.current = true;
    }
  }, [showBanner, pwa.isInstallable, logEvent]);

  useEffect(() => {
    const handleAppInstalled = () => {
      setShowBanner(false);
      logEvent('installed');
    };
    
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => window.removeEventListener('appinstalled', handleAppInstalled);
  }, [logEvent]);

  return {
    showBanner: showBanner && pwa.isInstallable && !pwa.isInstalled,
    isInstalled: pwa.isInstalled,
    isInstallable: pwa.isInstallable,
    isLoading: statusLoading,
    
    bannerText: promptStatus?.bannerText || 'Install our app for quick access',
    buttonText: promptStatus?.buttonText || 'Install App',
    trigger: promptStatus?.trigger,
    
    fireBookingConfirmed,
    fireFirstLogin,
    fireLoyaltyEarned,
    firePageVisit,
    showManualPrompt,
    
    dismissBanner,
    acceptInstall,
    
    promptStatus,
  };
}

export type { InstallTrigger, InstallPromptStatus };
