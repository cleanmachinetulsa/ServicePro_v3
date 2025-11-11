import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  MessageSquare,
  Phone,
  Monitor as MonitorIcon,
  Play,
  Pause,
  Hand,
  Bot,
  User,
  Send,
  Loader2,
  Settings,
  ArrowLeftRight,
  CheckCircle,
  X,
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { io, Socket } from 'socket.io-client';

interface Message {
  id: number;
  conversationId: number;
  content: string;
  sender: 'customer' | 'ai' | 'agent';
  fromCustomer: boolean;
  timestamp: string;
  channel?: 'web' | 'sms';
}

interface Conversation {
  id: number;
  customerId?: number;
  customerPhone: string;
  customerName?: string;
  category: string;
  intent: string;
  needsHumanAttention: boolean;
  resolved: boolean;
  lastMessageTime: string;
  platform: 'web' | 'sms';
  controlMode: 'auto' | 'manual' | 'paused';
  assignedAgent?: string;
  behaviorSettings?: any;
  status: 'active' | 'closed';
  createdAt: string;
  messageCount?: number;
  latestMessage?: Message;
  messages?: Message[];
}

export default function MonitorDashboard() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Behavior controls state
  const [tone, setTone] = useState('professional');
  const [forcedAction, setForcedAction] = useState('none');
  const [formality, setFormality] = useState([50]);
  const [responseLength, setResponseLength] = useState([50]);
  const [proactivity, setProactivity] = useState([50]);

  // Fetch all conversations
  const { data: conversationsData, refetch: refetchConversations } = useQuery({
    queryKey: ['/api/conversations'],
    refetchInterval: 5000, // Poll every 5 seconds as fallback
  });

  const conversations: Conversation[] = conversationsData?.data || [];

  // Fetch selected conversation details
  const { data: conversationDetail, refetch: refetchConversationDetail } = useQuery({
    queryKey: ['/api/conversations', selectedConversation?.id],
    enabled: !!selectedConversation,
  });

  // WebSocket connection
  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    // Join monitoring room
    newSocket.emit('join_monitoring');

    // Listen for new messages
    newSocket.on('new_message', ({ conversationId, message }: { conversationId: number, message: Message }) => {
      refetchConversations();
      if (selectedConversation?.id === conversationId) {
        refetchConversationDetail();
      }
    });

    // Listen for conversation updates
    newSocket.on('conversation_updated', () => {
      refetchConversations();
      if (selectedConversation) {
        refetchConversationDetail();
      }
    });

    // Listen for new conversations
    newSocket.on('new_conversation', () => {
      refetchConversations();
    });

    // Listen for control mode changes
    newSocket.on('control_mode_changed', ({ conversationId }: { conversationId: number }) => {
      refetchConversations();
      if (selectedConversation?.id === conversationId) {
        refetchConversationDetail();
      }
    });

    return () => {
      newSocket.emit('leave_monitoring');
      newSocket.close();
    };
  }, [selectedConversation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationDetail]);

  // Load behavior settings when conversation is selected
  useEffect(() => {
    if (selectedConversation?.behaviorSettings) {
      const settings = selectedConversation.behaviorSettings;
      setTone(settings.tone || 'professional');
      setForcedAction(settings.forcedAction || 'none');
      setFormality([settings.formality || 50]);
      setResponseLength([settings.responseLength || 50]);
      setProactivity([settings.proactivity || 50]);
    }
  }, [selectedConversation]);

  // Takeover mutation
  const takeoverMutation = useMutation({
    mutationFn: async (conversationId: number) => {
      return apiRequest(`/api/conversations/${conversationId}/takeover`, {
        method: 'POST',
        body: JSON.stringify({ agentUsername: 'Agent' }),
      });
    },
    onSuccess: () => {
      refetchConversations();
      refetchConversationDetail();
    },
  });

  // Handoff mutation
  const handoffMutation = useMutation({
    mutationFn: async (conversationId: number) => {
      return apiRequest(`/api/conversations/${conversationId}/handoff`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      refetchConversations();
      refetchConversationDetail();
    },
  });

  // Pause mutation
  const pauseMutation = useMutation({
    mutationFn: async (conversationId: number) => {
      return apiRequest(`/api/conversations/${conversationId}/pause`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      refetchConversations();
      refetchConversationDetail();
    },
  });

  // Resume mutation
  const resumeMutation = useMutation({
    mutationFn: async (conversationId: number) => {
      return apiRequest(`/api/conversations/${conversationId}/resume`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      refetchConversations();
      refetchConversationDetail();
    },
  });

  // Update behavior mutation
  const updateBehaviorMutation = useMutation({
    mutationFn: async ({ conversationId, settings }: { conversationId: number, settings: any }) => {
      return apiRequest(`/api/conversations/${conversationId}/behavior`, {
        method: 'PATCH',
        body: JSON.stringify(settings),
      });
    },
    onSuccess: () => {
      refetchConversations();
      refetchConversationDetail();
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, content, channel }: { conversationId: number, content: string, channel: 'web' | 'sms' }) => {
      return apiRequest(`/api/conversations/${conversationId}/send-message`, {
        method: 'POST',
        body: JSON.stringify({ content, channel }),
      });
    },
    onSuccess: () => {
      setMessageInput('');
      refetchConversationDetail();
    },
  });

  const handleTakeover = () => {
    if (selectedConversation) {
      takeoverMutation.mutate(selectedConversation.id);
    }
  };

  const handleHandoff = () => {
    if (selectedConversation) {
      handoffMutation.mutate(selectedConversation.id);
    }
  };

  const handlePause = () => {
    if (selectedConversation) {
      pauseMutation.mutate(selectedConversation.id);
    }
  };

  const handleResume = () => {
    if (selectedConversation) {
      resumeMutation.mutate(selectedConversation.id);
    }
  };

  const handleSendMessage = () => {
    if (selectedConversation && messageInput.trim()) {
      sendMessageMutation.mutate({
        conversationId: selectedConversation.id,
        content: messageInput,
        channel: selectedConversation.platform,
      });
    }
  };

  const handleUpdateBehavior = () => {
    if (selectedConversation) {
      updateBehaviorMutation.mutate({
        conversationId: selectedConversation.id,
        settings: {
          tone,
          forcedAction: forcedAction === 'none' ? undefined : forcedAction,
          formality: formality[0],
          responseLength: responseLength[0],
          proactivity: proactivity[0],
        },
      });
    }
  };

  const getControlModeColor = (mode: string) => {
    switch (mode) {
      case 'auto':
        return 'bg-green-500';
      case 'manual':
        return 'bg-blue-500';
      case 'paused':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const currentConversation = conversationDetail?.data || selectedConversation;
  const messages = currentConversation?.messages || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950/10 to-black p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 mb-2">
            Chat Monitoring Dashboard
          </h1>
          <p className="text-gray-400">Monitor and manage all customer conversations in real-time</p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Conversation List */}
          <Card className="bg-gray-800/50 backdrop-blur-sm border-blue-500/30 p-4">
            <h2 className="text-xl font-semibold text-blue-300 mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Active Conversations ({conversations.length})
            </h2>
            <ScrollArea className="h-[calc(100vh-250px)]">
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                      selectedConversation?.id === conv.id
                        ? 'bg-blue-600/30 border-2 border-blue-500'
                        : 'bg-gray-700/50 hover:bg-gray-700/70 border border-gray-600'
                    }`}
                    data-testid={`conversation-${conv.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {conv.platform === 'sms' ? (
                          <Phone className="h-4 w-4 text-green-400" />
                        ) : (
                          <MonitorIcon className="h-4 w-4 text-blue-400" />
                        )}
                        <span className="text-white font-medium">
                          {conv.customerName || conv.customerPhone}
                        </span>
                      </div>
                      <Badge className={`${getControlModeColor(conv.controlMode)} text-white text-xs`}>
                        {conv.controlMode}
                      </Badge>
                    </div>
                    <p className="text-gray-400 text-sm truncate">
                      {conv.latestMessage?.content || 'No messages yet'}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {formatTime(conv.lastMessageTime)}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>

          {/* Message Timeline */}
          <Card className="lg:col-span-2 bg-gray-800/50 backdrop-blur-sm border-blue-500/30 p-4">
            {selectedConversation ? (
              <>
                {/* Conversation Header */}
                <div className="mb-4 p-3 bg-gray-700/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {currentConversation?.customerName || currentConversation?.customerPhone}
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {currentConversation?.platform.toUpperCase()} • {currentConversation?.category}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${getControlModeColor(currentConversation?.controlMode)} text-white`}>
                        {currentConversation?.controlMode}
                      </Badge>
                      {currentConversation?.assignedAgent && (
                        <Badge className="bg-purple-500 text-white">
                          {currentConversation.assignedAgent}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Control Panel */}
                <div className="mb-4 p-3 bg-gradient-to-br from-blue-900/30 to-blue-950/30 backdrop-blur-sm border border-blue-800/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Settings className="h-4 w-4 text-blue-400" />
                    <h4 className="text-sm font-semibold text-blue-300">Conversation Controls</h4>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                    <Button
                      size="sm"
                      onClick={handleTakeover}
                      disabled={currentConversation?.controlMode === 'manual'}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid="button-takeover"
                    >
                      <Hand className="h-3 w-3 mr-1" />
                      Take Over
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleHandoff}
                      disabled={currentConversation?.controlMode !== 'manual'}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid="button-handoff"
                    >
                      <ArrowLeftRight className="h-3 w-3 mr-1" />
                      Handoff to AI
                    </Button>
                    <Button
                      size="sm"
                      onClick={currentConversation?.controlMode === 'paused' ? handleResume : handlePause}
                      className="bg-yellow-600 hover:bg-yellow-700"
                      data-testid="button-pause-resume"
                    >
                      {currentConversation?.controlMode === 'paused' ? (
                        <>
                          <Play className="h-3 w-3 mr-1" />
                          Resume
                        </>
                      ) : (
                        <>
                          <Pause className="h-3 w-3 mr-1" />
                          Pause
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleUpdateBehavior}
                      className="bg-purple-600 hover:bg-purple-700"
                      data-testid="button-update-behavior"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Apply Settings
                    </Button>
                  </div>

                  <Separator className="my-3 bg-blue-800/30" />

                  {/* Behavior Settings */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
                    <div>
                      <Label className="text-blue-300 text-xs mb-1">Tone</Label>
                      <Select value={tone} onValueChange={setTone}>
                        <SelectTrigger className="bg-gray-800 border-blue-500/30 text-white" data-testid="select-tone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="friendly">Friendly</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="formal">Formal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-blue-300 text-xs mb-1">Forced Action</Label>
                      <Select value={forcedAction} onValueChange={setForcedAction}>
                        <SelectTrigger className="bg-gray-800 border-blue-500/30 text-white" data-testid="select-forced-action">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="show_scheduler">Show Scheduler</SelectItem>
                          <SelectItem value="collect_info">Collect Info</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Behavior Sliders */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-blue-300 text-xs mb-1">
                        Formality: {formality[0]}%
                      </Label>
                      <Slider
                        value={formality}
                        onValueChange={setFormality}
                        max={100}
                        step={1}
                        className="mt-2"
                        data-testid="slider-formality"
                      />
                    </div>
                    <div>
                      <Label className="text-blue-300 text-xs mb-1">
                        Response Length: {responseLength[0]}%
                      </Label>
                      <Slider
                        value={responseLength}
                        onValueChange={setResponseLength}
                        max={100}
                        step={1}
                        className="mt-2"
                        data-testid="slider-response-length"
                      />
                    </div>
                    <div>
                      <Label className="text-blue-300 text-xs mb-1">
                        Proactivity: {proactivity[0]}%
                      </Label>
                      <Slider
                        value={proactivity}
                        onValueChange={setProactivity}
                        max={100}
                        step={1}
                        className="mt-2"
                        data-testid="slider-proactivity"
                      />
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="h-[calc(100vh-550px)] mb-4">
                  <div className="space-y-3 p-2">
                    {messages.map((message: Message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.sender === 'customer' ? 'justify-start' : 'justify-end'}`}
                        data-testid={`message-${message.sender}-${message.id}`}
                      >
                        <div
                          className={`max-w-[70%] p-3 rounded-lg ${
                            message.sender === 'customer'
                              ? 'bg-gray-700 text-white'
                              : message.sender === 'ai'
                              ? 'bg-blue-600 text-white'
                              : 'bg-purple-600 text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {message.sender === 'customer' ? (
                              <User className="h-3 w-3" />
                            ) : message.sender === 'ai' ? (
                              <Bot className="h-3 w-3" />
                            ) : (
                              <Hand className="h-3 w-3" />
                            )}
                            <span className="text-xs font-semibold capitalize">{message.sender}</span>
                            <span className="text-xs opacity-70">{formatTime(message.timestamp)}</span>
                          </div>
                          <p className="text-sm">{message.content}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Message Input */}
                {currentConversation?.controlMode === 'manual' && (
                  <div className="flex gap-2">
                    <Input
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Type your message..."
                      className="flex-1 bg-gray-800 border-blue-500/30 text-white"
                      disabled={sendMessageMutation.isPending}
                      data-testid="input-manual-message"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || sendMessageMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid="button-send-manual-message"
                    >
                      {sendMessageMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Select a conversation to view details</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
