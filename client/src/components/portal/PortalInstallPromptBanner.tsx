/**
 * Portal Install Prompt Banner
 * 
 * A configurable install prompt banner that uses tenant settings
 * for text, styling, and trigger conditions.
 */

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, X, Smartphone } from "lucide-react";
import { usePortalInstallPrompt } from "@/hooks/usePortalInstallPrompt";
import { cn } from "@/lib/utils";

interface PortalInstallPromptBannerProps {
  className?: string;
  position?: 'bottom' | 'top';
  variant?: 'gradient' | 'solid' | 'minimal';
}

export function PortalInstallPromptBanner({
  className,
  position = 'bottom',
  variant = 'gradient',
}: PortalInstallPromptBannerProps) {
  const {
    showBanner,
    bannerText,
    buttonText,
    dismissBanner,
    acceptInstall,
    isLoading,
  } = usePortalInstallPrompt();

  if (isLoading || !showBanner) {
    return null;
  }

  const positionClasses = position === 'bottom' 
    ? 'bottom-4 animate-in slide-in-from-bottom'
    : 'top-4 animate-in slide-in-from-top';

  const variantClasses = {
    gradient: 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-0',
    solid: 'bg-primary text-primary-foreground border-0',
    minimal: 'bg-background border border-border shadow-lg',
  };

  const iconBgClasses = {
    gradient: 'bg-white/20 backdrop-blur-sm',
    solid: 'bg-white/20',
    minimal: 'bg-primary/10',
  };

  const textClasses = {
    gradient: 'text-primary-foreground/90',
    solid: 'text-primary-foreground/90',
    minimal: 'text-muted-foreground',
  };

  const dismissBtnClasses = {
    gradient: 'text-white hover:bg-white/20',
    solid: 'text-white hover:bg-white/20',
    minimal: 'text-muted-foreground hover:bg-muted',
  };

  const installBtnClasses = {
    gradient: 'bg-white text-primary hover:bg-white/90 font-medium',
    solid: 'bg-white text-primary hover:bg-white/90 font-medium',
    minimal: 'bg-primary text-primary-foreground hover:bg-primary/90 font-medium',
  };

  return (
    <div className={cn(
      "fixed left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4",
      positionClasses,
      className
    )}>
      <Card className={cn("shadow-2xl", variantClasses[variant])}>
        <div className="p-4 flex items-center gap-4">
          <div className={cn("flex-shrink-0 p-3 rounded-xl", iconBgClasses[variant])}>
            <Smartphone className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
              <Download className="h-4 w-4" />
              Install App
            </h3>
            <p className={cn("text-xs truncate", textClasses[variant])}>
              {bannerText}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className={cn("h-8 w-8 p-0", dismissBtnClasses[variant])}
              onClick={dismissBanner}
              data-testid="button-dismiss-portal-install"
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className={installBtnClasses[variant]}
              onClick={acceptInstall}
              data-testid="button-accept-portal-install"
            >
              {buttonText}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function PortalInstallButton({ className }: { className?: string }) {
  const { isInstallable, isInstalled, showManualPrompt, acceptInstall } = usePortalInstallPrompt();

  if (isInstalled) {
    return null;
  }

  if (!isInstallable) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("gap-2", className)}
      onClick={() => {
        showManualPrompt();
        acceptInstall();
      }}
      data-testid="button-portal-install-manual"
    >
      <Download className="h-4 w-4" />
      Install App
    </Button>
  );
}

export default PortalInstallPromptBanner;
