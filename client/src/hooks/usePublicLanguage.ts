import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { setLanguage, getCurrentLanguage } from '@/i18n';

interface UsePublicLanguageOptions {
  tenantId?: string;
}

function safeGetLocalStorage(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(key);
    }
  } catch {
    // localStorage not available (e.g., SSR, test environments)
  }
  return null;
}

export function usePublicLanguage({ tenantId }: UsePublicLanguageOptions = {}) {
  const [location] = useLocation();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const detectLanguage = async () => {
      // Check URL query parameter first
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const langParam = urlParams.get('lang');

        if (langParam && ['en', 'es'].includes(langParam)) {
          setLanguage(langParam);
          setIsReady(true);
          return;
        }
      }

      // Check localStorage for previously stored language
      const storedLang = safeGetLocalStorage('i18nextLng');
      if (storedLang && ['en', 'es'].includes(storedLang)) {
        setLanguage(storedLang);
        setIsReady(true);
        return;
      }

      // Fetch tenant default language if tenantId is provided
      if (tenantId) {
        try {
          const response = await fetch(`/api/public/${tenantId}/language`);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.language) {
              setLanguage(data.language);
              setIsReady(true);
              return;
            }
          }
        } catch (error) {
          console.error('Failed to fetch tenant language:', error);
        }
      }

      // Default to English
      setLanguage('en');
      setIsReady(true);
    };

    detectLanguage();
  }, [location, tenantId]);

  return {
    isReady,
    currentLanguage: getCurrentLanguage(),
  };
}
