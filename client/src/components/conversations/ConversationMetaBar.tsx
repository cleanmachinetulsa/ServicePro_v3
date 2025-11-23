import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Bot, User, Clock, Pause } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ConversationMetaBarProps {
  controlMode: string;
  assignedAgent?: string | null;
  lastHandoffAt?: string | null;
  manualModeStartedAt?: string | null;
}

export function ConversationMetaBar({
  controlMode,
  assignedAgent,
  lastHandoffAt,
  manualModeStartedAt,
}: ConversationMetaBarProps) {
  
  function getControlModeBadge() {
    switch (controlMode) {
      case 'auto':
        return (
          <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700" data-testid="badge-control-mode">
            <Bot className="h-3 w-3 mr-1" />
            AI Control
          </Badge>
        );
      case 'manual':
        return (
          <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700" data-testid="badge-control-mode">
            <User className="h-3 w-3 mr-1" />
            Manual Control
          </Badge>
        );
      case 'paused':
        return (
          <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 border-gray-300 dark:border-gray-700" data-testid="badge-control-mode">
            <Pause className="h-3 w-3 mr-1" />
            Paused
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" data-testid="badge-control-mode">
            {controlMode}
          </Badge>
        );
    }
  }

  const timestamp = lastHandoffAt || manualModeStartedAt;

  return (
    <Card className="p-4 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 border-gray-200 dark:border-gray-800" data-testid="card-conversation-meta">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Control Mode
          </span>
          {getControlModeBadge()}
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Assigned Agent
          </span>
          <span className="text-sm text-gray-900 dark:text-gray-100" data-testid="text-assigned-agent">
            {assignedAgent || <span className="text-gray-500 italic">Unassigned</span>}
          </span>
        </div>

        {timestamp && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-800">
            <span className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last handoff
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-400" data-testid="text-last-handoff">
              {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
