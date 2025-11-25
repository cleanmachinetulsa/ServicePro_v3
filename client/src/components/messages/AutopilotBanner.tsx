import { Button } from '@/components/ui/button';
import { Bot, User } from 'lucide-react';

interface AutopilotBannerProps {
  controlMode: 'ai' | 'human' | 'hybrid' | 'auto' | 'manual' | 'paused';
  onTakeOver: () => void;
}

export function AutopilotBanner({ controlMode, onTakeOver }: AutopilotBannerProps) {
  const isAIMode = controlMode === 'ai' || controlMode === 'auto';
  
  if (!isAIMode) {
    return null;
  }

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Bot className="h-4 w-4 text-yellow-700 dark:text-yellow-400" />
          <span className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
            AI Autopilot Active
          </span>
        </div>
        <span className="text-xs text-yellow-700 dark:text-yellow-400">
          AI is handling this conversation
        </span>
      </div>
      
      <Button
        size="sm"
        variant="outline"
        onClick={onTakeOver}
        className="bg-white dark:bg-gray-800 border-yellow-300 dark:border-yellow-700 text-yellow-900 dark:text-yellow-200 hover:bg-yellow-100 dark:hover:bg-yellow-900/40"
        data-testid="button-take-over"
      >
        <User className="h-3.5 w-3.5 mr-1.5" />
        Take Over
      </Button>
    </div>
  );
}
