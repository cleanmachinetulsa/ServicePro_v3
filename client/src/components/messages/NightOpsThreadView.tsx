import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  ArrowLeft, 
  Send,
  MessageSquare
} from 'lucide-react';
import ThreadView from '@/components/ThreadView';
import { AutopilotBanner } from './AutopilotBanner';

interface NightOpsThreadViewProps {
  conversationId: number | null;
  onBack?: () => void;
  onTakeOver?: () => void;
  controlMode?: 'ai' | 'human' | 'hybrid' | 'auto' | 'manual' | 'paused';
}

export function NightOpsThreadView({
  conversationId,
  onBack,
  onTakeOver,
  controlMode = 'auto'
}: NightOpsThreadViewProps) {

  if (!conversationId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-20 h-20 rounded-full bg-slate-800/60 flex items-center justify-center mb-6 ring-1 ring-slate-700/60"
        >
          <MessageSquare className="h-10 w-10 text-slate-600" />
        </motion.div>
        <motion.h3 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="text-lg font-semibold text-slate-200 mb-2"
        >
          No conversation selected
        </motion.h3>
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="text-sm text-slate-500 max-w-sm"
        >
          Select a conversation from the inbox to view messages and start communicating
        </motion.p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 nightops-thread-wrapper">
      {onBack && (
        <div className="p-2 border-b border-slate-700/40 lg:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-slate-300 hover:text-slate-100 hover:bg-slate-800/60"
            data-testid="button-back-mobile"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      )}

      <div className="border-b border-slate-700/40">
        <AutopilotBanner
          controlMode={controlMode}
          onTakeOver={onTakeOver || (() => {})}
        />
      </div>

      <div className="flex-1 overflow-hidden flex flex-col nightops-threadview-container">
        <ThreadView
          conversationId={conversationId}
          onBack={undefined}
        />
      </div>
    </div>
  );
}
