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

  const { data: phoneLinesData, isLoading } = useQuery<{ success: boolean; lines: PhoneLine[] }>({
    queryKey: ['/api/phone-settings/lines'],
  });

  const phoneLines = phoneLinesData?.lines || [];

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
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Smartphone className="h-3.5 w-3.5" />
        <span className="font-medium">Line:</span>
      </div>
      
      <div 
        className="inline-flex items-center gap-1 bg-muted/40 dark:bg-muted/20 rounded-lg p-1"
        role="group"
        data-testid="phone-line-switcher"
      >
        {/* All Lines option */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedPhoneLineId(null)}
          className={`
            h-8 px-3 text-xs font-medium transition-all
            ${selectedPhoneLineId === null 
              ? 'bg-background dark:bg-background shadow-sm text-foreground' 
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
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
              h-8 px-3 text-xs font-medium transition-all
              ${selectedPhoneLineId === line.id 
                ? 'bg-background dark:bg-background shadow-sm text-foreground' 
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
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
