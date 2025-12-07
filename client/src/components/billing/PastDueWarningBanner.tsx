/**
 * Past Due Warning Banner (SP-6)
 * 
 * Shows a yellow warning bar when tenant billing is past due but not suspended.
 */

import { Link } from 'wouter';
import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

interface PastDueWarningBannerProps {
  onDismiss?: () => void;
}

export function PastDueWarningBanner({ onDismiss }: PastDueWarningBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div 
      className="bg-amber-500 text-white px-4 py-3" 
      role="alert"
      data-testid="banner-past-due"
    >
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">
            We had trouble processing your last payment. Please{' '}
            <Link 
              href="/settings/billing" 
              className="underline font-semibold hover:text-amber-100"
              data-testid="link-update-payment"
            >
              update your payment method
            </Link>{' '}
            to avoid service interruption.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-amber-600 rounded transition-colors"
          aria-label="Dismiss"
          data-testid="button-dismiss-warning"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
