import { useEffect, useLayoutEffect, useState } from "react";
import ReactDOM from "react-dom";
import { Button } from "@/components/ui/button";

export interface DashboardTourStep {
  id: string;
  targetId: string;
  title: string;
  body: string;
}

interface DashboardTourProps {
  steps: DashboardTourStep[];
  isOpen: boolean;
  onClose: () => void;
  onFinish: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function DashboardTour({
  steps,
  isOpen,
  onClose,
  onFinish,
}: DashboardTourProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const step = steps[currentIndex];
    if (!step) return;

    const el = document.querySelector(
      `[data-tour-id="${step.targetId}"]`
    ) as HTMLElement | null;

    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
      
      // Scroll element into view
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      setTargetRect(null);
    }
  }, [isOpen, currentIndex, steps]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen || steps.length === 0) return null;

  const step = steps[currentIndex];
  if (!step) return null;

  const goNext = () => {
    if (currentIndex === steps.length - 1) {
      onFinish();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const overlay = (
    <div
      className="fixed inset-0 z-[9999] bg-black/60"
      style={{ pointerEvents: "none" }}
    >
      {/* Highlight box */}
      {targetRect && (
        <div
          className="fixed rounded-lg pointer-events-none ring-4 ring-white ring-offset-0 shadow-2xl"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="fixed max-w-sm p-6 rounded-xl bg-white dark:bg-gray-900 shadow-2xl border-2 border-gray-200 dark:border-gray-700"
        style={{
          top: (targetRect?.top ?? 80) + (targetRect?.height ?? 0) + 20,
          left: targetRect?.left ?? 24,
          pointerEvents: "auto",
        }}
      >
        <div className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">
          {step.title}
        </div>
        <div className="text-sm mb-4 text-gray-700 dark:text-gray-300 leading-relaxed">
          {step.body}
        </div>
        <div className="flex justify-between items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-gray-600 dark:text-gray-400"
            data-testid="button-skip-tour"
          >
            Skip tour
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goPrev}
              disabled={currentIndex === 0}
              className={currentIndex === 0 ? "opacity-40 cursor-not-allowed" : ""}
              data-testid="button-tour-back"
            >
              Back
            </Button>
            <Button
              size="sm"
              onClick={goNext}
              className="font-semibold"
              data-testid="button-tour-next"
            >
              {currentIndex === steps.length - 1 ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
          Step {currentIndex + 1} of {steps.length}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(overlay, document.body);
}
