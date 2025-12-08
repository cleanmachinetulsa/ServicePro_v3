import { forwardRef } from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ButtonWithTooltipProps extends ButtonProps {
  tooltip: string;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  tooltipAlign?: "start" | "center" | "end";
  delayDuration?: number;
}

const ButtonWithTooltip = forwardRef<HTMLButtonElement, ButtonWithTooltipProps>(
  ({ tooltip, tooltipSide = "top", tooltipAlign = "center", delayDuration = 200, children, ...props }, ref) => {
    return (
      <Tooltip delayDuration={delayDuration}>
        <TooltipTrigger asChild>
          <Button ref={ref} {...props}>
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide} align={tooltipAlign}>
          <p className="text-sm">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
);

ButtonWithTooltip.displayName = "ButtonWithTooltip";

/**
 * TooltipButtonGroup wraps multiple ButtonWithTooltip components
 * with a shared TooltipProvider for better performance.
 * Use this when rendering multiple tooltip buttons together.
 */
const TooltipButtonGroup = ({ children, delayDuration = 200 }: { children: React.ReactNode; delayDuration?: number }) => {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      {children}
    </TooltipProvider>
  );
};

export { ButtonWithTooltip, TooltipButtonGroup };
