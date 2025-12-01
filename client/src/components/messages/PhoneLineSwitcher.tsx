import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Smartphone } from 'lucide-react';
import { usePhoneLine } from '@/contexts/PhoneLineContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect } from 'react';

interface PhoneLine {
  id: number;
  label: string;
  phoneNumber: string;
  isActive: boolean;
}

export default function PhoneLineSwitcher() {
  const { conversationFilter, setConversationFilter, activeSendLineId, setActiveSendLineId } = usePhoneLine();

  const { data: phoneLinesData, isLoading } = useQuery<{ success: boolean; lines: PhoneLine[] }>({
    queryKey: ['/api/phone-settings/lines'],
  });

  const phoneLines = phoneLinesData?.lines || [];
  const activeLine = phoneLines.find(line => line.id === activeSendLineId);

  // CRITICAL: Validate activeSendLineId exists in phone lines list using useEffect
  // If invalid, auto-select first available working line (prefer Main Business Line)
  useEffect(() => {
    if (phoneLines.length > 0 && !activeLine && !isLoading) {
      // Find first working line (prefer line 1 = Main Business Line, otherwise first active line)
      const preferredLine = phoneLines.find(line => line.id === 1 && line.isActive);
      const fallbackLine = phoneLines.find(line => line.isActive) || phoneLines[0];
      const validLine = preferredLine || fallbackLine;
      
      console.warn(`[PhoneLineSwitcher] activeSendLineId ${activeSendLineId} not found in phone lines. Auto-selecting line ${validLine.id}`);
      setActiveSendLineId(validLine.id);
    }
  }, [phoneLines, activeLine, isLoading, activeSendLineId, setActiveSendLineId]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (phoneLines.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* FILTER: Which conversations to display */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
          <span>Viewing:</span>
        </div>
        <div 
          className="flex flex-wrap items-center gap-1.5 bg-gradient-to-r from-muted/50 to-muted/30 dark:from-muted/20 dark:to-muted/10 rounded-xl p-1.5 shadow-sm border border-border/50"
          role="group"
          data-testid="conversation-filter"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConversationFilter(null)}
            className={`
              h-8 px-3 text-xs font-medium transition-all rounded-lg whitespace-nowrap
              ${conversationFilter === null 
                ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }
            `}
            data-testid="filter-all-lines"
          >
            All Lines
          </Button>
          
          {phoneLines.map((line) => (
            <Button
              key={line.id}
              variant="ghost"
              size="sm"
              onClick={() => setConversationFilter(line.id)}
              className={`
                h-8 px-3 text-xs font-medium transition-all rounded-lg whitespace-nowrap
                ${conversationFilter === line.id 
                  ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }
              `}
              data-testid={`filter-line-${line.id}`}
            >
              {line.label}
            </Button>
          ))}
        </div>
      </div>

      {/* SENDER: Which line messages are sent from */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
          <Smartphone className="h-3.5 w-3.5" />
          <span>Sending from:</span>
        </div>
        <div 
          className="flex flex-wrap items-center gap-1.5 bg-gradient-to-r from-blue-50/50 to-blue-100/30 dark:from-blue-950/20 dark:to-blue-900/10 rounded-xl p-1.5 shadow-sm border border-blue-200/50 dark:border-blue-800/50"
          role="group"
          data-testid="active-send-line"
        >
          {phoneLines.map((line) => (
            <Button
              key={line.id}
              variant="ghost"
              size="sm"
              onClick={() => setActiveSendLineId(line.id)}
              className={`
                h-8 px-3 text-xs font-medium transition-all rounded-lg whitespace-nowrap
                ${activeSendLineId === line.id 
                  ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-blue-100/50 dark:hover:bg-blue-900/30'
                }
              `}
              data-testid={`send-line-${line.id}`}
            >
              {line.label}
            </Button>
          ))}
        </div>
        {activeLine && (
          <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium px-1">
            Messages will be sent from {activeLine.phoneNumber}
          </div>
        )}
      </div>
    </div>
  );
}
