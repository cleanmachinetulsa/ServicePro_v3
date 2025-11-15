import { useQuery } from "@tanstack/react-query";
import type { Banner } from "@shared/schema";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function BannerDisplay() {
  const [location, setLocation] = useLocation();
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(new Set());

  // Helper function to handle navigation (internal vs external)
  const handleNavigation = (url: string) => {
    // Use blacklist approach: Detect URLs that MUST use full page navigation
    // Everything else gets SPA navigation (flexible for new routes)
    
    // External protocols → full page navigation
    if (url.startsWith('http://') || url.startsWith('https://') || 
        url.startsWith('//') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      window.location.href = url;
      return;
    }
    
    // API endpoints → full page navigation
    if (url.startsWith('/api/')) {
      window.location.href = url;
      return;
    }
    
    // Asset/download paths → full page navigation
    const assetPrefixes = ['/uploads/', '/downloads/', '/assets/', '/static/', '/files/'];
    if (assetPrefixes.some(prefix => url.startsWith(prefix))) {
      window.location.href = url;
      return;
    }
    
    // File extensions → full page navigation (downloads)
    const fileExtensions = ['.pdf', '.zip', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', 
                           '.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov', '.avi', '.mp3', '.wav'];
    if (fileExtensions.some(ext => url.toLowerCase().includes(ext))) {
      window.location.href = url;
      return;
    }
    
    // Everything else (internal SPA routes) → wouter navigation
    // Handles all app routes including hash fragments and query strings
    setLocation(url);
  };

  const { data: banners = [] } = useQuery<Banner[]>({
    queryKey: ["/api/banners/active"],
    queryFn: async () => {
      const response = await fetch("/api/banners/active", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch banners");
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Load dismissed banners from localStorage on mount
  useEffect(() => {
    const dismissed = new Set<string>();
    banners.forEach((banner) => {
      if (localStorage.getItem(`banner_dismissed_${banner.trackingKey}`)) {
        dismissed.add(banner.trackingKey);
      }
    });
    
    // Only update state if the set actually changed
    setDismissedBanners((prev) => {
      const prevArray = Array.from(prev).sort();
      const newArray = Array.from(dismissed).sort();
      if (JSON.stringify(prevArray) === JSON.stringify(newArray)) {
        return prev; // No change, don't trigger re-render
      }
      return dismissed;
    });
  }, [banners]);

  const handleDismiss = (banner: Banner) => {
    if (banner.isDismissible) {
      localStorage.setItem(`banner_dismissed_${banner.trackingKey}`, "true");
      setDismissedBanners((prev) => new Set(prev).add(banner.trackingKey));
    }
  };

  // Filter banners for current page and dismissed status
  const visibleBanners = banners.filter((banner) => {
    // Check if dismissed
    if (dismissedBanners.has(banner.trackingKey)) return false;

    // Check page targeting
    if (banner.pageTargets && banner.pageTargets.length > 0) {
      return banner.pageTargets.includes(location);
    }

    return true; // Show on all pages if no targeting
  });

  // Separate banners by display mode
  const topBarBanners = visibleBanners.filter((b) => b.displayMode === "top_bar");
  const modalBanners = visibleBanners.filter((b) => b.displayMode === "modal");
  const floatingBanners = visibleBanners.filter((b) => b.displayMode === "floating");

  const getThemeColors = (themeColor: string) => {
    const themes: Record<string, { bg: string; text: string; border: string }> = {
      blue: { bg: "bg-blue-500/10 dark:bg-blue-500/20", text: "text-blue-900 dark:text-blue-100", border: "border-blue-500/20" },
      red: { bg: "bg-red-500/10 dark:bg-red-500/20", text: "text-red-900 dark:text-red-100", border: "border-red-500/20" },
      green: { bg: "bg-green-500/10 dark:bg-green-500/20", text: "text-green-900 dark:text-green-100", border: "border-green-500/20" },
      yellow: { bg: "bg-yellow-500/10 dark:bg-yellow-500/20", text: "text-yellow-900 dark:text-yellow-100", border: "border-yellow-500/20" },
      purple: { bg: "bg-purple-500/10 dark:bg-purple-500/20", text: "text-purple-900 dark:text-purple-100", border: "border-purple-500/20" },
    };
    return themes[themeColor] || themes.blue;
  };

  return (
    <>
      {/* Top Bar Banners */}
      {topBarBanners.map((banner) => {
        const theme = getThemeColors(banner.themeColor || "blue");
        return (
          <div
            key={banner.id}
            className={`w-full ${theme.bg} ${theme.text} border-b ${theme.border} py-3 px-4 relative`}
            data-testid={`banner-topbar-${banner.trackingKey}`}
          >
            <div className="container mx-auto flex items-center justify-between gap-4">
              <div className="flex-1 flex items-center gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-sm sm:text-base">{banner.title}</h3>
                  <p className="text-xs sm:text-sm opacity-90">{banner.bodyText}</p>
                </div>
                {banner.ctaLabel && banner.ctaUrl && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleNavigation(banner.ctaUrl!)}
                    data-testid={`banner-cta-${banner.trackingKey}`}
                  >
                    {banner.ctaLabel}
                  </Button>
                )}
              </div>
              {banner.isDismissible && (
                <button
                  onClick={() => handleDismiss(banner)}
                  className="p-1 hover:opacity-70 transition-opacity"
                  data-testid={`banner-dismiss-${banner.trackingKey}`}
                  aria-label="Dismiss banner"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Modal Banners */}
      {modalBanners.map((banner, index) => {
        const theme = getThemeColors(banner.themeColor || "blue");
        return (
          <Dialog
            key={banner.id}
            open={true}
            onOpenChange={() => handleDismiss(banner)}
          >
            <DialogContent
              className={`sm:max-w-md ${theme.bg} ${theme.text} border ${theme.border}`}
              data-testid={`banner-modal-${banner.trackingKey}`}
            >
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">{banner.title}</h2>
                <p className="text-sm opacity-90 whitespace-pre-wrap">{banner.bodyText}</p>
                {banner.ctaLabel && banner.ctaUrl && (
                  <div className="flex justify-end gap-2">
                    {banner.isDismissible && (
                      <Button
                        variant="outline"
                        onClick={() => handleDismiss(banner)}
                        data-testid={`banner-modal-dismiss-${banner.trackingKey}`}
                      >
                        Maybe Later
                      </Button>
                    )}
                    <Button
                      variant="default"
                      onClick={() => handleNavigation(banner.ctaUrl!)}
                      data-testid={`banner-modal-cta-${banner.trackingKey}`}
                    >
                      {banner.ctaLabel}
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        );
      })}

      {/* Floating Banners */}
      {floatingBanners.map((banner, index) => {
        const theme = getThemeColors(banner.themeColor || "blue");
        return (
          <Card
            key={banner.id}
            className={`fixed bottom-4 right-4 max-w-sm ${theme.bg} ${theme.text} border ${theme.border} shadow-lg z-50`}
            data-testid={`banner-floating-${banner.trackingKey}`}
            style={{ bottom: `${4 + index * 160}px` }} // Stack multiple floating banners
          >
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sm">{banner.title}</h3>
                {banner.isDismissible && (
                  <button
                    onClick={() => handleDismiss(banner)}
                    className="p-1 hover:opacity-70 transition-opacity shrink-0"
                    data-testid={`banner-floating-dismiss-${banner.trackingKey}`}
                    aria-label="Dismiss banner"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="text-xs opacity-90 whitespace-pre-wrap">{banner.bodyText}</p>
              {banner.ctaLabel && banner.ctaUrl && (
                <Button
                  size="sm"
                  variant="default"
                  className="w-full"
                  onClick={() => handleNavigation(banner.ctaUrl!)}
                  data-testid={`banner-floating-cta-${banner.trackingKey}`}
                >
                  {banner.ctaLabel}
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </>
  );
}
