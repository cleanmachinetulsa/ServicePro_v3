import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Bot, CheckCircle } from 'lucide-react';
import { handbackConversationToAI } from '@/lib/conversationApi';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface HandoffControlsProps {
  conversationId: number;
  controlMode: string;
  onHandbackComplete?: () => void;
}

export function HandoffControls({
  conversationId,
  controlMode,
  onHandbackComplete,
}: HandoffControlsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  async function handleReturnToAI() {
    try {
      setIsLoading(true);
      
      const result = await handbackConversationToAI(conversationId, {
        notifyCustomer,
        force: false,
      });

      if (result.success) {
        toast({
          title: 'Returned to AI',
          description: result.message || 'Conversation is now under AI control',
        });

        // Refresh conversation data
        queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
        queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}`] });
        
        onHandbackComplete?.();
      } else {
        throw new Error(result.message || 'Failed to hand back conversation');
      }
    } catch (error) {
      console.error('[HANDBACK] Error:', error);
      toast({
        title: 'Handback failed',
        description: error instanceof Error ? error.message : 'Failed to return conversation to AI',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  const isManualMode = controlMode === 'manual';

  return (
    <Card className="p-4 space-y-4" data-testid="card-handoff-controls">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2">
          <Bot className="h-4 w-4 text-blue-600" />
          AI Handoff
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {isManualMode 
            ? 'Return this conversation to AI control when ready.'
            : 'This conversation is already under AI control.'}
        </p>
      </div>

      {isManualMode && (
        <>
          <div className="flex items-center justify-between py-2">
            <Label htmlFor="notify-customer" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              Notify customer
            </Label>
            <Switch
              id="notify-customer"
              checked={notifyCustomer}
              onCheckedChange={setNotifyCustomer}
              data-testid="switch-notify-customer"
            />
          </div>

          <Button
            onClick={handleReturnToAI}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            data-testid="button-return-to-ai"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Returning to AI...
              </>
            ) : (
              <>
                <Bot className="h-4 w-4 mr-2" />
                Return to AI
              </>
            )}
          </Button>
        </>
      )}

      {!isManualMode && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <span className="text-sm text-emerald-700 dark:text-emerald-400">
            AI is handling this conversation
          </span>
        </div>
      )}
    </Card>
  );
}
