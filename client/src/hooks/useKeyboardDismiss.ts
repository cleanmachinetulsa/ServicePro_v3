import { useEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * Universal keyboard auto-dismiss hook for mobile devices
 * 
 * Automatically dismisses the mobile keyboard when:
 * 1. Route changes (navigation)
 * 2. User taps outside input fields
 * 3. Forms are submitted
 * 
 * Usage: Call this hook in your root App component to enable app-wide
 */
export function useKeyboardDismiss() {
  const [location] = useLocation();

  useEffect(() => {
    // Dismiss keyboard on route change
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [location]);

  useEffect(() => {
    // Dismiss keyboard when clicking/tapping outside input elements
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is outside input/textarea elements
      if (
        target &&
        target.tagName !== 'INPUT' &&
        target.tagName !== 'TEXTAREA' &&
        !target.closest('input') &&
        !target.closest('textarea')
      ) {
        if (document.activeElement instanceof HTMLElement) {
          // Only blur if it's an input or textarea
          const activeEl = document.activeElement;
          if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') {
            activeEl.blur();
          }
        }
      }
    };

    // Listen for both mouse and touch events
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // Dismiss keyboard on form submissions
    const handleFormSubmit = () => {
      setTimeout(() => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }, 100); // Small delay to ensure the submit action completes
    };

    // Listen for all form submit events
    document.addEventListener('submit', handleFormSubmit);

    return () => {
      document.removeEventListener('submit', handleFormSubmit);
    };
  }, []);

  // Dismiss keyboard when dialogs/modals open
  useEffect(() => {
    const handleDialogOpen = () => {
      if (document.activeElement instanceof HTMLElement) {
        const activeEl = document.activeElement;
        if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') {
          activeEl.blur();
        }
      }
    };

    // Listen for dialog state changes (Radix UI triggers these)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-state') {
          const target = mutation.target as HTMLElement;
          if (target.getAttribute('data-state') === 'open') {
            handleDialogOpen();
          }
        }
      });
    });

    // Observe all dialog/sheet elements
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-state']
    });

    return () => {
      observer.disconnect();
    };
  }, []);
}
