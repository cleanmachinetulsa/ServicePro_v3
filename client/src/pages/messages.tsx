import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { PhoneLineProvider, usePhoneLine } from '@/contexts/PhoneLineContext';
import { useLocation, useSearch } from 'wouter';
import { 
  PlusCircle, 
  PanelRight, 
  PanelRightClose,
  Phone,
  CalendarDays
} from 'lucide-react';
import io from 'socket.io-client';
import { NightOpsMessagesLayout } from '@/components/messages/NightOpsMessagesLayout';
import { NightOpsConversationList } from '@/components/messages/NightOpsConversationList';
import { NightOpsThreadView } from '@/components/messages/NightOpsThreadView';
import { NightOpsContextPanel } from '@/components/messages/NightOpsContextPanel';
import Composer from '@/components/messages/Composer';
import { useToast } from '@/hooks/use-toast';
import { ShareAvailabilityModal } from '@/components/ShareAvailabilityModal';
import { apiRequest } from '@/lib/queryClient';
import { useCustomerSidebarData } from '@/hooks/useCustomerSidebarData';

interface Conversation {
  id: number;
  customerName: string | null;
  customerPhone: string;
  platform: string;
  controlMode: string;
  needsHumanAttention: boolean;
  lastMessageTime: string;
  messageCount: number;
  latestMessage: {
    content: string;
    sender: string;
    timestamp: string;
  } | null;
  status: string;
  unreadCount: number;
  starred: boolean;
  archived: boolean;
  pinned: boolean;
  pinnedAt: string | null;
  archivedAt: string | null;
  starredAt: string | null;
  phoneLineId: number | null;
}

function MessagesPageContent() {
  const { conversationFilter } = usePhoneLine();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfilePanel, setShowProfilePanel] = useState(true);
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [showShareAvailabilityModal, setShowShareAvailabilityModal] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: conversationsData, isLoading } = useQuery<{ success: boolean; data: Conversation[] }>({
    queryKey: ['/api/conversations', filter, conversationFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ status: filter });
      if (conversationFilter !== null) {
        params.append('phoneLineId', conversationFilter.toString());
      }
      const response = await fetch(`/api/conversations?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return response.json();
    },
    refetchInterval: 10000,
  });

  const conversations = conversationsData?.data || [];

  useEffect(() => {
    const params = new URLSearchParams(search);
    const phoneParam = params.get('phone');
    const conversationParam = params.get('conversation');
    
    if (conversations.length === 0) return;
    
    if (phoneParam) {
      const matchingConv = conversations.find(c => c.customerPhone === phoneParam);
      if (matchingConv) {
        setSelectedConversation(matchingConv.id);
        setLocation('/messages', { replace: true });
      }
    } else if (conversationParam) {
      const conversationId = parseInt(conversationParam, 10);
      if (!isNaN(conversationId)) {
        setSelectedConversation(conversationId);
        setLocation('/messages', { replace: true });
      }
    }
  }, [search, conversations, setLocation]);

  const filteredConversations = conversations.filter((conv) => {
    let categoryMatch = false;
    switch (filter) {
      case 'all': categoryMatch = true; break;
      case 'sms': categoryMatch = conv.platform === 'sms'; break;
      case 'web': categoryMatch = conv.platform === 'web'; break;
      case 'facebook': categoryMatch = conv.platform === 'facebook'; break;
      case 'instagram': categoryMatch = conv.platform === 'instagram'; break;
      case 'email': categoryMatch = conv.platform === 'email'; break;
      default: categoryMatch = true; break;
    }
    if (!categoryMatch) return false;
    if (!searchQuery.trim()) return true;
    
    const searchLower = searchQuery.toLowerCase();
    return (
      conv.customerName?.toLowerCase().includes(searchLower) ||
      conv.customerPhone.includes(searchLower) ||
      conv.latestMessage?.content.toLowerCase().includes(searchLower)
    );
  });

  const sortedConversations = [...filteredConversations].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
  });

  const handleTakeOver = async () => {
    if (!selectedConversation) return;

    try {
      await apiRequest('POST', `/api/conversations/${selectedConversation}/takeover`, {});
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({
        title: 'Control taken',
        description: 'You now have manual control of this conversation',
      });
    } catch (error) {
      console.error('Failed to take control:', error);
      toast({
        title: 'Failed to take control',
        description: 'Could not switch to manual mode',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    const socket = io();

    socket.on('connect', () => {
      console.log('[MESSAGES] Connected to WebSocket');
      socket.emit('join_monitoring');
    });

    socket.on('new_message', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    });

    socket.on('conversation_updated', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    });

    socket.on('control_mode_changed', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    });

    return () => {
      socket.emit('leave_monitoring');
      socket.disconnect();
    };
  }, [queryClient]);

  const selectedConv = conversations.find(c => c.id === selectedConversation);
  const { customerInfo, isLoading: isLoadingCustomer } = useCustomerSidebarData(selectedConversation);

  const conversationListNode = (
    <NightOpsConversationList
      conversations={sortedConversations}
      selectedId={selectedConversation}
      onSelect={setSelectedConversation}
      isLoading={isLoading}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      filter={filter}
      onFilterChange={setFilter}
    />
  );

  const threadViewNode = (
    <NightOpsThreadView
      conversationId={selectedConversation}
      onBack={() => setSelectedConversation(null)}
      onTakeOver={handleTakeOver}
      controlMode={selectedConv?.controlMode as any}
    />
  );

  const contextPanelNode = (
    <NightOpsContextPanel
      customerInfo={selectedConversation ? customerInfo : null}
      isLoading={selectedConversation ? isLoadingCustomer : false}
      onBookAppointment={undefined}
    />
  );

  return (
    <>
      <NightOpsMessagesLayout
        conversationList={conversationListNode}
        threadView={threadViewNode}
        contextPanel={contextPanelNode}
        showContextPanel={showProfilePanel && !!selectedConversation}
      />

      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <Button 
          size="sm" 
          onClick={() => setShowComposeDialog(true)}
          data-testid="button-compose"
          className="nightops-button text-xs"
        >
          <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
          New
        </Button>
        {selectedConversation && (
          <>
            <Button 
              size="sm" 
              onClick={() => setShowShareAvailabilityModal(true)}
              data-testid="button-share-availability"
              className="nightops-button text-xs"
              title="Share calendar availability"
            >
              <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
              Share
            </Button>
            <Button 
              size="sm" 
              onClick={() => setShowProfilePanel(!showProfilePanel)}
              className="nightops-button text-xs hidden lg:flex"
              data-testid="button-toggle-profile"
              title={showProfilePanel ? "Hide Context Panel" : "Show Context Panel"}
            >
              {showProfilePanel ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRight className="h-3.5 w-3.5" />}
            </Button>
          </>
        )}
        <Button 
          size="sm" 
          onClick={() => setLocation('/phone')}
          data-testid="button-phone"
          className="nightops-button text-xs"
          title="Phone & Voicemail"
        >
          <Phone className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Composer
        isOpen={showComposeDialog}
        onOpenChange={setShowComposeDialog}
        onSuccess={(conversationId) => {
          if (conversationId) setSelectedConversation(conversationId);
        }}
      />

      {selectedConv && (
        <ShareAvailabilityModal
          open={showShareAvailabilityModal}
          onClose={() => setShowShareAvailabilityModal(false)}
          contactName={selectedConv.customerName || undefined}
          contactFirstName={selectedConv.customerName?.split(' ')[0] || undefined}
          channelType={selectedConv.platform as 'sms' | 'email' | 'facebook' | 'instagram'}
          onMessageGenerated={(messageText) => {
            navigator.clipboard.writeText(messageText);
            toast({
              title: 'Availability copied',
              description: 'Message copied to clipboard - paste it in the message field',
            });
            setShowShareAvailabilityModal(false);
          }}
        />
      )}

      {!selectedConversation && (
        <Button
          onClick={() => setShowComposeDialog(true)}
          className="lg:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full nightops-button-primary shadow-[0_0_20px_rgba(34,211,238,0.5)] z-50"
          size="icon"
          data-testid="fab-compose-mobile"
        >
          <PlusCircle className="h-6 w-6" />
        </Button>
      )}
    </>
  );
}

export default function MessagesPage() {
  return (
    <PhoneLineProvider>
      <MessagesPageContent />
    </PhoneLineProvider>
  );
}
