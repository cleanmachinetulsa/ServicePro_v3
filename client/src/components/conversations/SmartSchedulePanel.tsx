import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CalendarDays, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';
import { fetchSmartSchedule, type ParsedBookingInfo } from '@/lib/conversationApi';
import { useToast } from '@/hooks/use-toast';

interface SmartSchedulePanelProps {
  conversationId: number;
}

export function SmartSchedulePanel({ conversationId }: SmartSchedulePanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [parsedInfo, setParsedInfo] = useState<ParsedBookingInfo | null>(null);
  const { toast } = useToast();

  async function handleExtractBookingInfo() {
    try {
      setIsLoading(true);
      const info = await fetchSmartSchedule(conversationId);
      setParsedInfo(info);
      
      toast({
        title: info.readyToBook ? 'Ready to book!' : 'Information extracted',
        description: info.readyToBook 
          ? 'All required details collected. You can create the appointment.'
          : `Missing: ${info.missingInfo.join(', ')}`,
      });
    } catch (error) {
      console.error('[SMART SCHEDULE] Error:', error);
      toast({
        title: 'Extraction failed',
        description: error instanceof Error ? error.message : 'Failed to analyze conversation',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function getConfidenceBadge(confidence: string) {
    const variants = {
      high: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
      medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
      low: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    };
    
    return (
      <Badge className={variants[confidence as keyof typeof variants] || variants.medium} data-testid="badge-confidence">
        {confidence} confidence
      </Badge>
    );
  }

  return (
    <Card className="p-4 space-y-4" data-testid="card-smart-schedule">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-600" />
          Smart Schedule
        </h3>
      </div>

      {!parsedInfo ? (
        <Button
          onClick={handleExtractBookingInfo}
          disabled={isLoading}
          className="w-full"
          variant="outline"
          data-testid="button-extract-booking"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing conversation...
            </>
          ) : (
            <>
              <CalendarDays className="h-4 w-4 mr-2" />
              Extract booking details
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-4">
          {/* Status Header */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2">
              {parsedInfo.readyToBook ? (
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              )}
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {parsedInfo.readyToBook ? 'Ready to schedule' : 'More info needed'}
              </span>
            </div>
            {getConfidenceBadge(parsedInfo.confidence)}
          </div>

          {/* Extracted Details */}
          <div className="space-y-3 text-sm">
            {parsedInfo.customerName && (
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400">Customer</Label>
                <div className="font-medium text-gray-900 dark:text-gray-100" data-testid="text-customer-name">
                  {parsedInfo.customerName}
                </div>
              </div>
            )}

            {parsedInfo.serviceType && (
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400">Service</Label>
                <div className="font-medium text-gray-900 dark:text-gray-100" data-testid="text-service-type">
                  {parsedInfo.serviceType}
                </div>
              </div>
            )}

            {parsedInfo.preferredDate && (
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400">Preferred Date/Time</Label>
                <div className="font-medium text-gray-900 dark:text-gray-100" data-testid="text-preferred-datetime">
                  {parsedInfo.preferredDate} {parsedInfo.preferredTime && `at ${parsedInfo.preferredTime}`}
                </div>
              </div>
            )}

            {parsedInfo.address && (
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400">Location</Label>
                <div className="font-medium text-gray-900 dark:text-gray-100" data-testid="text-address">
                  {parsedInfo.address}
                </div>
              </div>
            )}

            {parsedInfo.addOns && parsedInfo.addOns.length > 0 && (
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400">Add-ons</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {parsedInfo.addOns.map((addon, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {addon}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {parsedInfo.extractionNotes && (
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400">AI Notes</Label>
                <p className="text-xs text-gray-700 dark:text-gray-300 italic" data-testid="text-extraction-notes">
                  {parsedInfo.extractionNotes}
                </p>
              </div>
            )}

            {parsedInfo.missingInfo.length > 0 && (
              <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
                <Label className="text-xs font-semibold text-yellow-800 dark:text-yellow-400">
                  Still Need:
                </Label>
                <ul className="mt-1 text-xs text-yellow-700 dark:text-yellow-300 space-y-1" data-testid="list-missing-info">
                  {parsedInfo.missingInfo.map((item, idx) => (
                    <li key={idx}>• {item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setParsedInfo(null)}
              data-testid="button-reset"
            >
              Reset
            </Button>
            {parsedInfo.readyToBook && (
              <Button
                size="sm"
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                onClick={() => {
                  toast({
                    title: 'Opening booking form',
                    description: 'Pre-filling with extracted details...',
                  });
                  // TODO: Integrate with existing booking form/calendar system
                }}
                data-testid="button-create-appointment"
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                Create Appointment
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
