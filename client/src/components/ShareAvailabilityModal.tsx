import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Copy, Loader2, MessageSquare, Clock } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface ShareAvailabilityModalProps {
  open: boolean;
  onClose: () => void;
  contactName?: string;
  contactFirstName?: string;
  channelType: 'sms' | 'email' | 'facebook' | 'instagram';
  onMessageGenerated: (messageText: string) => void;
}

interface AvailabilityTemplate {
  id: number;
  name: string;
  introText: string;
  ctaText: string;
  channelType: string | null;
}

interface DayAvailability {
  date: string;
  slots: string[];
  hasAvailability: boolean;
}

interface AvailabilityResponse {
  messageText: string;
  htmlText?: string;
  rawAvailability: DayAvailability[];
  template: {
    id: number;
    name: string;
  };
}

export function ShareAvailabilityModal({
  open,
  onClose,
  contactName,
  contactFirstName,
  channelType,
  onMessageGenerated,
}: ShareAvailabilityModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>();
  const [serviceDuration, setServiceDuration] = useState<number>(180); // 3 hours default
  const [generatedData, setGeneratedData] = useState<AvailabilityResponse | null>(null);

  // Fetch available templates
  const { data: templatesData, isLoading: templatesLoading } = useQuery<{
    success: boolean;
    data: AvailabilityTemplate[];
  }>({
    queryKey: ['/api/availability-templates'],
    enabled: open,
  });

  const templates = templatesData?.data || [];

  // Set default template when templates load
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      // Find channel-specific default or global default
      const channelDefault = templates.find(
        (t) => t.channelType === channelType && templates.some((t2) => t2.channelType === channelType)
      );
      const globalDefault = templates.find((t) => t.channelType === null);
      const defaultTemplate = channelDefault || globalDefault || templates[0];
      setSelectedTemplateId(defaultTemplate.id);
    }
  }, [templates, channelType, selectedTemplateId]);

  // Generate availability message
  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/calendar/share-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName,
          contactFirstName,
          channelType,
          templateId: selectedTemplateId,
          serviceDurationMinutes: serviceDuration,
          daysAhead: 14,
        }),
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setGeneratedData(data.data);
        toast({
          title: 'Availability generated',
          description: 'Preview your message below',
        });
      } else {
        throw new Error(data.error || 'Failed to generate availability');
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate availability message',
        variant: 'destructive',
      });
    },
  });

  // Auto-generate when template or duration changes
  useEffect(() => {
    if (open && selectedTemplateId && !generateMutation.isPending) {
      generateMutation.mutate();
    }
  }, [selectedTemplateId, serviceDuration, open]);

  const handleUseMessage = () => {
    if (generatedData) {
      onMessageGenerated(generatedData.messageText);
      toast({
        title: 'Message added',
        description: 'Availability message added to composer',
      });
      onClose();
    }
  };

  const handleCopyToClipboard = async () => {
    if (generatedData) {
      try {
        await navigator.clipboard.writeText(generatedData.messageText);
        toast({
          title: 'Copied!',
          description: 'Message copied to clipboard',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to copy to clipboard',
          variant: 'destructive',
        });
      }
    }
  };

  const serviceDurationOptions = [
    { value: 60, label: '1 hour' },
    { value: 120, label: '2 hours' },
    { value: 180, label: '3 hours' },
    { value: 240, label: '4 hours' },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="share-availability-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            Share Availability
          </DialogTitle>
          <DialogDescription>
            Generate a formatted availability message for {contactFirstName || contactName || 'your customer'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Selector */}
          <div className="space-y-2">
            <Label htmlFor="template-select">Message Template</Label>
            {templatesLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                value={selectedTemplateId?.toString()}
                onValueChange={(value) => setSelectedTemplateId(parseInt(value, 10))}
              >
                <SelectTrigger id="template-select" data-testid="select-template">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem
                      key={template.id}
                      value={template.id.toString()}
                      data-testid={`template-option-${template.id}`}
                    >
                      {template.name}
                      {template.channelType && ` (${template.channelType})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Service Duration Selector */}
          <div className="space-y-2">
            <Label htmlFor="duration-select">Appointment Duration</Label>
            <Select
              value={serviceDuration.toString()}
              onValueChange={(value) => setServiceDuration(parseInt(value, 10))}
            >
              <SelectTrigger id="duration-select" data-testid="select-duration">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                {serviceDurationOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value.toString()}
                    data-testid={`duration-option-${option.value}`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview Area */}
          {generateMutation.isPending && (
            <div className="flex items-center justify-center py-12" data-testid="loading-indicator">
              <div className="text-center space-y-2">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">Checking calendar availability...</p>
              </div>
            </div>
          )}

          {generatedData && !generateMutation.isPending && (
            <Tabs defaultValue="formatted" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="formatted" data-testid="tab-formatted">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Formatted Message
                </TabsTrigger>
                <TabsTrigger value="structured" data-testid="tab-structured">
                  <CalendarDays className="w-4 h-4 mr-2" />
                  Day-by-Day View
                </TabsTrigger>
              </TabsList>

              <TabsContent value="formatted" className="space-y-2">
                <Card className="p-4 bg-muted/50">
                  <pre className="whitespace-pre-wrap font-sans text-sm" data-testid="preview-formatted">
                    {generatedData.messageText}
                  </pre>
                </Card>
              </TabsContent>

              <TabsContent value="structured" className="space-y-2">
                <div className="space-y-3" data-testid="preview-structured">
                  {generatedData.rawAvailability.filter(day => day.hasAvailability).length === 0 ? (
                    <Card className="p-4 bg-muted/50 text-center text-muted-foreground">
                      <p>No availability found for the next two weeks</p>
                    </Card>
                  ) : (
                    generatedData.rawAvailability
                      .filter((day) => day.hasAvailability)
                      .map((day, index) => (
                        <Card key={index} className="p-4" data-testid={`day-card-${index}`}>
                          <h4 className="font-semibold mb-2">{day.date}</h4>
                          <ul className="space-y-1">
                            {day.slots.map((slot, slotIndex) => (
                              <li key={slotIndex} className="text-sm flex items-center gap-2">
                                <Clock className="w-3 h-3 text-muted-foreground" />
                                {slot}
                              </li>
                            ))}
                          </ul>
                        </Card>
                      ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel">
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleCopyToClipboard}
            disabled={!generatedData || generateMutation.isPending}
            data-testid="button-copy"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy to Clipboard
          </Button>
          <Button
            onClick={handleUseMessage}
            disabled={!generatedData || generateMutation.isPending}
            data-testid="button-use-message"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Use This Message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
