import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { PhoneLineProvider, usePhoneLine } from '@/contexts/PhoneLineContext';
import PhoneLineSwitcher from '@/components/messages/PhoneLineSwitcher';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  MessageCircle, 
  PlusCircle, 
  Moon, 
  Sun, 
  PanelRight, 
  PanelRightClose, 
  User
} from 'lucide-react';
import io from 'socket.io-client';
import ThreadView from '@/components/ThreadView';
import CustomerProfilePanel from '@/components/CustomerProfilePanel';
import ConversationFilters from '@/components/messages/ConversationFilters';
import ConversationList from '@/components/messages/ConversationList';
import Composer from '@/components/messages/Composer';
import { AppShell } from '@/components/AppShell';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

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
  const [operatorDialogOpen, setOperatorDialogOpen] = useState(false);
  const [operatorName, setOperatorName] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch user data for operator name
  const { data: userData } = useQuery<{ success: boolean; user: { operatorName?: string | null } }>({
    queryKey: ['/api/users/me'],
  });

  useEffect(() => {
    if (userData?.user?.operatorName) {
      setOperatorName(userData.user.operatorName);
    }
  }, [userData]);

  // Update operator name mutation
  const updateOperatorMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest('PUT', '/api/users/me/operator-name', { operatorName: name });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/me'] });
      toast({
        title: 'Success',
        description: 'Operator name updated successfully',
      });
      setOperatorDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update operator name',
        variant: 'destructive',
      });
    },
  });

  const handleSaveOperatorName = () => {
    updateOperatorMutation.mutate(operatorName);
  };

  // Fetch conversations
  const { data: conversationsData, isLoading } = useQuery<{ success: boolean; data: Conversation[] }>({
    queryKey: ['/api/conversations', filter, selectedPhoneLineId],
    enabled: selectedPhoneLineId !== null,
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

  // Page-specific actions for AppShell
  const pageActions = (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setShowComposeDialog(true)}
        data-testid="button-compose"
      >
        <PlusCircle className="h-4 w-4 mr-2" />
        <span className="hidden sm:inline">New Message</span>
      </Button>
      {selectedConversation && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowProfilePanel(!showProfilePanel)}
          className="hidden md:flex"
          data-testid="button-toggle-profile"
          title={showProfilePanel ? "Hide Profile Panel" : "Show Profile Panel"}
        >
          {showProfilePanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
        </Button>
      )}
      <Dialog open={operatorDialogOpen} onOpenChange={setOperatorDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" data-testid="button-operator-settings">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Operator</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Set Operator Name</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Configure your name to personalize message templates. This replaces "our team" in automated messages.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="operator-name" className="dark:text-white">
                Your Name
              </Label>
              <Input
                id="operator-name"
                data-testid="input-operator-name"
                placeholder="e.g., Sarah, Mike, Team Leader"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                className="dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              />
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                Leave empty to use "our team" in templates
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOperatorDialogOpen(false)}
              data-testid="button-cancel-operator"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveOperatorName}
              disabled={updateOperatorMutation.isPending}
              data-testid="button-save-operator"
            >
              {updateOperatorMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setDarkMode(!darkMode)}
        data-testid="button-dark-mode"
      >
        {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </>
  );

  return (
    <AppShell title="Messages" showSearch={false} pageActions={pageActions}>
      <div className="flex h-full overflow-hidden">
        <div className={`${selectedConversation ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 border-r flex-col bg-white dark:bg-gray-900 dark:border-gray-800 shadow-sm`}>
          <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3">
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

        <div className={`${selectedConversation ? 'flex' : 'hidden md:flex'} flex-1 min-h-0 items-center justify-center bg-white dark:bg-gray-950`}>
          {selectedConversation ? (
            <ThreadView conversationId={selectedConversation} />
          ) : (
            <div className="text-center px-4">
              <MessageCircle className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl md:text-2xl font-semibold mb-2 dark:text-white">
                Select a conversation
              </h2>
              <p className="text-sm md:text-base text-muted-foreground dark:text-gray-400">
                Choose a conversation from the list to view and reply
              </p>
            </div>
          )}
        </div>

        {selectedConversation && showProfilePanel && (
          <div className="w-80 lg:w-96 border-l flex flex-col bg-white dark:bg-gray-900 dark:border-gray-800 shadow-sm hidden md:flex">
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
