import { usePwa } from "@/contexts/PwaContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, WifiOff, X, Share2 } from "lucide-react";
import { useState } from "react";

// Install Prompt Banner - Shows when app can be installed
export function InstallPromptBanner() {
  const { isInstallable, promptInstall } = usePwa();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!isInstallable || isDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 animate-in slide-in-from-bottom">
      <Card className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-0 shadow-2xl">
        <div className="p-4 flex items-center gap-4">
          <div className="flex-shrink-0 p-3 bg-white/20 rounded-xl backdrop-blur-sm">
            <Download className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm mb-1">Install Clean Machine</h3>
            <p className="text-xs text-blue-50">Get quick access from your home screen</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
              onClick={() => setIsDismissed(true)}
              data-testid="button-dismiss-install"
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-white text-blue-600 hover:bg-blue-50 font-medium"
              onClick={promptInstall}
              data-testid="button-install-app"
            >
              Install
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Offline Indicator - Shows when user is offline
export function OfflineIndicator() {
  const { isOnline } = usePwa();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top">
      <div className="bg-orange-500 text-white py-2 px-4 text-center flex items-center justify-center gap-2 text-sm font-medium">
        <WifiOff className="h-4 w-4" />
        <span>You're offline. Changes will sync when connection is restored.</span>
      </div>
    </div>
  );
}

// Share Button - Uses Web Share API when available
interface ShareButtonProps {
  title: string;
  text: string;
  url?: string;
  className?: string;
}

export function ShareButton({ title, text, url, className }: ShareButtonProps) {
  const { canShare, shareContent } = usePwa();

  if (!canShare) {
    return null;
  }

  const handleShare = async () => {
    try {
      await shareContent({
        title,
        text,
        url: url || window.location.href,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleShare}
      className={className}
      data-testid="button-share"
    >
      <Share2 className="h-4 w-4 mr-2" />
      Share
    </Button>
  );
}

// PWA Status Badge - Shows install status
export function PwaStatusBadge() {
  const { isInstalled, isOnline } = usePwa();

  return (
    <div className="flex gap-2">
      {isInstalled && (
        <Badge variant="secondary" className="text-xs">
          Installed
        </Badge>
      )}
      {!isOnline && (
        <Badge variant="destructive" className="text-xs">
          Offline
        </Badge>
      )}
    </div>
  );
}
