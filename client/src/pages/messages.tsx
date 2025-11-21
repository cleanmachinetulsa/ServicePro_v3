import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { PhoneLineProvider, usePhoneLine } from '@/contexts/PhoneLineContext';
import PhoneLineSwitcher from '@/components/messages/PhoneLineSwitcher';
import { useLocation, useSearch } from 'wouter';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { 
  MessageCircle, 
  PlusCircle, 
  Moon, 
  Sun, 
  PanelRight, 
  PanelRightClose,
  Phone,
  CalendarDays
} from 'lucide-react';
import io from 'socket.io-client';
import ThreadView from '@/components/ThreadView';
import CustomerProfilePanel from '@/components/CustomerProfilePanel';
import ConversationFilters from '@/components/messages/ConversationFilters';
import ConversationList from '@/components/messages/ConversationList';
import Composer from '@/components/messages/Composer';
import { AppShell } from '@/components/AppShell';
import { useToast } from '@/hooks/use-toast';
import { RecentCallersWidget } from '@/components/messages/RecentCallersWidget';
import { ShareAvailabilityModal } from '@/components/ShareAvailabilityModal';

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
  const { selectedPhoneLineId } = usePhoneLine();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [showMobileProfileSheet, setShowMobileProfileSheet] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true';
    }
    return false;
  });
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [showShareAvailabilityModal, setShowShareAvailabilityModal] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch conversations
  const { data: conversationsData, isLoading } = useQuery<{ success: boolean; data: Conversation[] }>({
    queryKey: ['/api/conversations', filter, selectedPhoneLineId],
    queryFn: async () => {
      const params = new URLSearchParams({ status: filter });
      if (selectedPhoneLineId !== null) {
        params.append('phoneLineId', selectedPhoneLineId.toString());
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

  // Handle ?phone= URL parameter to open specific conversation
  useEffect(() => {
    const params = new URLSearchParams(search);
    const phoneParam = params.get('phone');
    
    if (phoneParam && conversations.length > 0) {
      // Find conversation matching this phone number
      const matchingConv = conversations.find(c => c.customerPhone === phoneParam);
      
      if (matchingConv) {
        setSelectedConversation(matchingConv.id);
        // Clear the phone parameter from URL
        setLocation('/messages', { replace: true });
      }
    }
  }, [search, conversations, setLocation]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

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

  useEffect(() => {
    if (!selectedConversation && showMobileProfileSheet) {
      setShowMobileProfileSheet(false);
    }
  }, [selectedConversation, showMobileProfileSheet]);

  useEffect(() => {
    const socket = io();

    socket.on('connect', () => {
      console.log('[MESSAGES] Connected to WebSocket');
      socket.emit('join_monitoring');
    });

    socket.on('new_message', (data: any) => {
      console.log('[MESSAGES] New message received:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    });

    socket.on('conversation_updated', (data: any) => {
      console.log('[MESSAGES] Conversation updated:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    });

    socket.on('control_mode_changed', (data: any) => {
      console.log('[MESSAGES] Control mode changed:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    });

    return () => {
      socket.emit('leave_monitoring');
      socket.disconnect();
    };
  }, [queryClient]);

  // Get selected conversation details for Share Availability
  const selectedConv = conversations.find(c => c.id === selectedConversation);

  // Page-specific actions for AppShell
  const pageActions = (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setShowComposeDialog(true)}
        data-testid="button-compose"
        className="transition-all duration-200 hover:scale-105"
      >
        <PlusCircle className="h-4 w-4 mr-2" />
        <span className="hidden sm:inline">New Message</span>
      </Button>
      {selectedConversation && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowShareAvailabilityModal(true)}
          data-testid="button-share-availability"
          className="transition-all duration-200 hover:scale-105"
          title="Share calendar availability with customer"
        >
          <CalendarDays className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Share Availability</span>
        </Button>
      )}
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setLocation('/phone')}
        data-testid="button-phone"
        className="transition-all duration-200 hover:scale-105"
        title="Open Phone & Voicemail"
      >
        <Phone className="h-4 w-4" />
        <span className="hidden sm:inline ml-2">Phone</span>
      </Button>
      {selectedConversation && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowProfilePanel(!showProfilePanel)}
          className="hidden md:flex transition-all duration-200 hover:scale-105"
          data-testid="button-toggle-profile"
          title={showProfilePanel ? "Hide Profile Panel" : "Show Profile Panel"}
        >
          {showProfilePanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
        </Button>
      )}
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setDarkMode(!darkMode)}
        data-testid="button-dark-mode"
        className="transition-all duration-200 hover:scale-105"
      >
        {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </>
  );

  return (
    <AppShell title="Messages" showSearch={false} pageActions={pageActions}>
      <div className="flex h-full overflow-hidden bg-gradient-to-br from-gray-50/30 to-gray-100/20 dark:from-gray-950/50 dark:to-gray-900/30" data-page-wrapper>
        {/* Conversation List Sidebar - Google Voice Polished */}
        <div className={`${selectedConversation ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col bg-white/98 dark:bg-gray-900/98 backdrop-blur-md border-r border-gray-200/60 dark:border-gray-800/60 shadow-xl transition-all duration-300`}>
          <div className="border-b border-gray-200/70 dark:border-gray-800/70 px-4 py-3 bg-gradient-to-b from-white/60 to-transparent dark:from-gray-900/60">
            <PhoneLineSwitcher />
          </div>
          <ConversationFilters
            activeFilter={filter}
            onFilterChange={setFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
          <ConversationList
            conversations={sortedConversations}
            selectedId={selectedConversation}
            onSelect={setSelectedConversation}
            isLoading={isLoading}
          />
        </div>

        {/* Main Thread View - Polished Center */}
        <div className={`${selectedConversation ? 'flex' : 'hidden md:flex'} flex-1 min-h-0 items-center justify-center bg-gradient-to-br from-white to-gray-50/30 dark:from-gray-950 dark:to-gray-900/30 transition-all duration-300`}>
          {selectedConversation ? (
            <ThreadView conversationId={selectedConversation} />
          ) : (
            <div className="w-full max-w-2xl px-4 py-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center glass-card p-10 rounded-3xl">
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-full p-6 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                  <MessageCircle className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-3 bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  Select a conversation
                </h2>
                <p className="text-base text-muted-foreground/80 leading-relaxed">
                  Choose a conversation from the list to view messages and reply
                </p>
              </div>
              
              <RecentCallersWidget />
            </div>
          )}
        </div>

        {/* Customer Profile Panel - Polished Side */}
        {selectedConversation && showProfilePanel && (
          <div className="w-80 lg:w-96 border-l border-gray-200/60 dark:border-gray-800/60 flex flex-col bg-white/98 dark:bg-gray-900/98 backdrop-blur-md shadow-xl hidden md:flex transition-all duration-300">
            <CustomerProfilePanel conversationId={selectedConversation} />
          </div>
        )}
      </div>

      <Composer
        isOpen={showComposeDialog}
        onOpenChange={setShowComposeDialog}
        onSuccess={(conversationId) => {
          if (conversationId) setSelectedConversation(conversationId);
        }}
      />

      <Sheet open={showMobileProfileSheet} onOpenChange={setShowMobileProfileSheet}>
        <SheetContent side="right" className="w-full sm:w-96 p-0 dark:bg-gray-900 dark:border-gray-800">
          <SheetHeader className="px-6 py-4 border-b dark:border-gray-800">
            <SheetTitle className="dark:text-white">Customer Profile</SheetTitle>
            <SheetDescription className="dark:text-gray-400">
              View customer information and history
            </SheetDescription>
          </SheetHeader>
          {selectedConversation && (
            <div className="h-[calc(100vh-5rem)] overflow-auto">
              <CustomerProfilePanel conversationId={selectedConversation} />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {selectedConv && (
        <ShareAvailabilityModal
          open={showShareAvailabilityModal}
          onClose={() => setShowShareAvailabilityModal(false)}
          contactName={selectedConv.customerName || undefined}
          contactFirstName={selectedConv.customerName?.split(' ')[0] || undefined}
          channelType={selectedConv.platform as 'sms' | 'email' | 'facebook' | 'instagram'}
          onMessageGenerated={(messageText) => {
            // Copy to clipboard and show success toast
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
          className="md:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow z-50"
          size="icon"
          data-testid="fab-compose-mobile"
        >
          <PlusCircle className="h-6 w-6" />
        </Button>
      )}
    </AppShell>
  );
}

export default function MessagesPage() {
  return (
    <PhoneLineProvider>
      <MessagesPageContent />
    </PhoneLineProvider>
  );
}
