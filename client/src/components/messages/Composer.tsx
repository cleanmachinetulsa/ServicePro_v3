import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { Smartphone, MessageCircle, Mail } from 'lucide-react';
import { FaFacebook, FaInstagram } from 'react-icons/fa';
import { toE164, formatAsYouType, isValid } from '@/lib/phone';

interface ComposerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (conversationId?: number) => void;
}

export default function Composer({ isOpen, onOpenChange, onSuccess }: ComposerProps) {
  const [platform, setPlatform] = useState<'sms' | 'web' | 'facebook' | 'instagram' | 'email'>('sms');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [socialId, setSocialId] = useState('');
  const [name, setName] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setPlatform('sms');
      setPhone('');
      setEmail('');
      setSocialId('');
      setName('');
    }
  }, [isOpen]);

  // Create new conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (data: { phone?: string; email?: string; socialId?: string; name: string; platform: string }) => {
      return await apiRequest('POST', '/api/conversations/create', data);
    },
    onSuccess: async (response) => {
      const data = await response.json();
      toast({ 
        title: 'Conversation started', 
        description: `Started conversation with ${name || phone}` 
      });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      
      // Call success callback with conversation ID
      if (data.conversation?.id) {
        onSuccess(data.conversation.id);
      } else {
        onSuccess();
      }
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to start conversation', 
        variant: 'destructive',
        duration: 8000, // 8 seconds for error toasts
        action: (
          <ToastAction altText="Try again" onClick={() => handleSubmit()}>
            Retry
          </ToastAction>
        ),
      });
    },
  });

  const handleSubmit = () => {
    // Validate based on platform
    if (platform === 'sms') {
      if (!phone.trim()) {
        toast({ 
          title: 'Phone required', 
          description: 'Please enter a phone number', 
          variant: 'destructive',
          duration: 8000, // 8 seconds for validation errors
        });
        return;
      }
      
      if (!isValid(phone)) {
        toast({ 
          title: 'Invalid phone number', 
          description: 'Please enter a valid phone number', 
          variant: 'destructive',
          duration: 8000, // 8 seconds for validation errors
        });
        return;
      }
    }
    
    if (platform === 'email' && !email.trim()) {
      toast({ 
        title: 'Email required', 
        description: 'Please enter an email address', 
        variant: 'destructive',
        duration: 8000, // 8 seconds for validation errors
      });
      return;
    }
    if ((platform === 'facebook' || platform === 'instagram') && !socialId.trim()) {
      toast({ 
        title: 'ID required', 
        description: `Please enter ${platform} user ID`, 
        variant: 'destructive',
        duration: 8000, // 8 seconds for validation errors
      });
      return;
    }

    const e164Phone = platform === 'sms' ? toE164(phone) || undefined : undefined;

    createConversationMutation.mutate({ 
      phone: e164Phone,
      email: platform === 'email' ? email : undefined,
      socialId: (platform === 'facebook' || platform === 'instagram') ? socialId : undefined,
      name, 
      platform 
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="dark:bg-gray-800 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="dark:text-white">New Message</DialogTitle>
          <DialogDescription className="dark:text-gray-400">
            Start a new conversation with a customer
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Platform Selector */}
          <div>
            <Label htmlFor="platform" className="dark:text-gray-300">Communication Platform *</Label>
            <Select value={platform} onValueChange={(value: any) => setPlatform(value)}>
              <SelectTrigger className="dark:bg-gray-700 dark:border-gray-600 dark:text-white" data-testid="select-platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sms">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    <span>SMS / Text Message</span>
                  </div>
                </SelectItem>
                <SelectItem value="web">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    <span>Web Chat</span>
                  </div>
                </SelectItem>
                <SelectItem value="facebook">
                  <div className="flex items-center gap-2">
                    <FaFacebook className="h-4 w-4" />
                    <span>Facebook Messenger</span>
                  </div>
                </SelectItem>
                <SelectItem value="instagram">
                  <div className="flex items-center gap-2">
                    <FaInstagram className="h-4 w-4" />
                    <span>Instagram Direct</span>
                  </div>
                </SelectItem>
                <SelectItem value="email">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>Email</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Conditional Contact Fields */}
          {platform === 'sms' && (
            <div>
              <Label htmlFor="phone" className="dark:text-gray-300">Phone Number *</Label>
              <Input
                id="phone"
                placeholder="(918) 555-1234"
                value={phone}
                onChange={(e) => setPhone(formatAsYouType(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSubmit())}
                data-testid="input-compose-phone"
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                autoFocus
              />
            </div>
          )}

          {platform === 'email' && (
            <div>
              <Label htmlFor="email" className="dark:text-gray-300">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="customer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSubmit())}
                data-testid="input-compose-email"
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                autoFocus
              />
            </div>
          )}

          {(platform === 'facebook' || platform === 'instagram') && (
            <div>
              <Label htmlFor="social-id" className="dark:text-gray-300">
                {platform === 'facebook' ? 'Facebook' : 'Instagram'} User ID *
              </Label>
              <Input
                id="social-id"
                placeholder="1234567890"
                value={socialId}
                onChange={(e) => setSocialId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSubmit())}
                data-testid="input-compose-social-id"
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                This is usually provided by the {platform} webhook when they message you first
              </p>
            </div>
          )}

          {platform === 'web' && (
            <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Web chat conversations start automatically when customers visit your website and use the chat widget.
              </p>
            </div>
          )}

          {/* Customer Name - Always shown */}
          <div>
            <Label htmlFor="name" className="dark:text-gray-300">Customer Name (Optional)</Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSubmit())}
              data-testid="input-compose-name"
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={createConversationMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createConversationMutation.isPending}
            data-testid="button-start-conversation"
          >
            {createConversationMutation.isPending ? 'Starting...' : 'Start Conversation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
