import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Smartphone } from 'lucide-react';
import { usePhoneLine } from '@/contexts/PhoneLineContext';
import { Skeleton } from '@/components/ui/skeleton';

interface PhoneLine {
  id: number;
  label: string;
  phoneNumber: string;
}

export default function PhoneLineSwitcher() {
  const { selectedPhoneLineId, setSelectedPhoneLineId } = usePhoneLine();

  const { data: phoneLinesData, isLoading, error } = useQuery<{ success: boolean; lines: PhoneLine[] }>({
    queryKey: ['/api/phone-settings/lines'],
  });

  const phoneLines = phoneLinesData?.lines || [];

  console.log('[PhoneLineSwitcher] Debug:', { 
    isLoading, 
    error, 
    phoneLinesData, 
    phoneLines: phoneLines.length 
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-1 bg-muted/40 dark:bg-muted/20 rounded-lg p-1">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
    );
  }

  if (phoneLines.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
        <Smartphone className="h-4 w-4" />
        <span>Active Line:</span>
      </div>
      
      <div 
        className="inline-flex items-center gap-1.5 bg-gradient-to-r from-muted/50 to-muted/30 dark:from-muted/20 dark:to-muted/10 rounded-xl p-1.5 shadow-sm border border-border/50"
        role="group"
        data-testid="phone-line-switcher"
      >
        {/* All Lines option */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedPhoneLineId(null)}
          className={`
            h-9 px-4 text-sm font-medium transition-all rounded-lg
            ${selectedPhoneLineId === null 
              ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }
          `}
          data-testid="phone-line-all"
        >
          All Lines
        </Button>
        
        {/* Individual phone lines */}
        {phoneLines.map((line) => (
          <Button
            key={line.id}
            variant="ghost"
            size="sm"
            onClick={() => setSelectedPhoneLineId(line.id)}
            className={`
              h-9 px-4 text-sm font-medium transition-all rounded-lg
              ${selectedPhoneLineId === line.id 
                ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }
            `}
            data-testid={`phone-line-${line.id}`}
          >
            {line.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
