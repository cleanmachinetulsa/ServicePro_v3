import { Button } from '@/components/ui/button';
import { ArrowLeft, Send } from 'lucide-react';
import { AutopilotBanner } from './AutopilotBanner';
import ThreadView from '@/components/ThreadView';

interface ThreadPaneProps {
  conversationId: number | null;
  onBack?: () => void;
  onTakeOver?: () => void;
  controlMode?: 'ai' | 'human' | 'hybrid' | 'auto' | 'manual' | 'paused';
  isMobile?: boolean;
}

export function ThreadPane({
  conversationId,
  onBack,
  onTakeOver,
  controlMode = 'auto',
  isMobile = false
}: ThreadPaneProps) {

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <Send className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            No conversation selected
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select a conversation from the list to start messaging
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-950 min-h-0">
      {/* Mobile Back Button */}
      {isMobile && onBack && (
        <div className="p-2 border-b border-gray-200 dark:border-gray-800 md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            data-testid="button-back-mobile"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      )}

      {/* Autopilot Banner - Fixed at top */}
      <AutopilotBanner
        controlMode={controlMode}
        onTakeOver={onTakeOver || (() => {})}
      />

      {/* Thread View - Includes composer */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <ThreadView
          conversationId={conversationId}
          onBack={isMobile ? onBack : undefined}
        />
      </div>
    </div>
  );
}
