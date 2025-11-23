import { useEffect, useState, useCallback } from "react";

interface UseDashboardOnboardingOptions {
  initialHasSeenTour?: boolean;
  userId?: number | null;
}

interface DashboardOnboardingState {
  hasSeenTour: boolean;
  shouldShowTour: boolean;
  setShouldShowTour: (value: boolean) => void;
  markTourCompleted: () => Promise<void>;
}

const LOCAL_STORAGE_KEY = "servicepro:dashboardTourSeen";

export function useDashboardOnboarding(
  options: UseDashboardOnboardingOptions
): DashboardOnboardingState {
  const { initialHasSeenTour = false, userId } = options;

  const [hasSeenTour, setHasSeenTour] = useState<boolean>(initialHasSeenTour);
  const [shouldShowTour, setShouldShowTour] = useState<boolean>(false);

  // Pull backup from localStorage
  useEffect(() => {
    if (initialHasSeenTour) {
      setHasSeenTour(true);
      return;
    }
    const stored = typeof window !== "undefined"
      ? window.localStorage.getItem(LOCAL_STORAGE_KEY)
      : null;
    if (stored === "true") {
      setHasSeenTour(true);
    }
  }, [initialHasSeenTour]);

  // Decide if we should show tour on load
  useEffect(() => {
    if (!hasSeenTour) {
      setShouldShowTour(true);
    }
  }, [hasSeenTour]);

  const markTourCompleted = useCallback(async () => {
    setHasSeenTour(true);
    setShouldShowTour(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, "true");
    }

    try {
      await fetch("/api/users/dashboard-tour/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Failed to mark dashboard tour completed", err);
    }
  }, [userId]);

  return {
    hasSeenTour,
    shouldShowTour,
    setShouldShowTour,
    markTourCompleted,
  };
}
