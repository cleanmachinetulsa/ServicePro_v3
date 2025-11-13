import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Phone, MessageSquare, Send, Loader2, PhoneMissed, PhoneOff, Mic, MicOff } from 'lucide-react';
import { useTechnician } from '@/contexts/TechnicianContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const QUICK_REPLIES = [
  "I'm on my way! ETA 15 minutes.",
  "Arrived at your location.",
  "Running about 10 minutes late, apologies!",
  "Job complete! Thank you for your business.",
];

export function CommunicationsPod() {
  const { selectedJob, messages, sendMessage, makeCall, endCall, callStatus, activeCall } = useTechnician();
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedJob) return;

    setIsSending(true);
    try {
      await sendMessage(messageText);
      setMessageText('');
      toast({
        title: 'Message Sent',
        description: 'Your message has been delivered',
      });
    } catch (error: any) {
      toast({
        title: 'Send Failed',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickReply = (reply: string) => {
    setMessageText(reply);
  };

  const handleCall = () => {
    if (!selectedJob?.customerPhone) {
      toast({
        title: 'No Phone Number',
        description: 'This customer does not have a phone number',
        variant: 'destructive',
      });
      return;
    }

    if (callStatus === 'in-progress') {
      endCall();
    } else {
      makeCall(selectedJob.customerPhone);
    }
  };

  const toggleMute = () => {
    if (activeCall) {
      if (isMuted) {
        activeCall.mute(false);
      } else {
        activeCall.mute(true);
      }
      setIsMuted(!isMuted);
    }
  };

  if (!selectedJob) {
    return (
      <Card className="h-full bg-white/5 border-white/10">
        <CardContent className="flex items-center justify-center h-full">
          <p className="text-blue-300 text-sm">Select a job to view communications</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col bg-white/5 border-white/10">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Communications
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col space-y-4">
        {/* Call Section */}
        <div className="flex-shrink-0">
          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-blue-200">Customer Contact</h3>
                <p className="text-white text-sm">{selectedJob.customerPhone || 'No phone'}</p>
              </div>
              
              {callStatus !== 'idle' && callStatus !== 'disconnected' && (
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  callStatus === 'in-progress' ? 'bg-green-500 text-white animate-pulse' :
                  callStatus === 'connecting' ? 'bg-yellow-500 text-white animate-pulse' :
                  'bg-gray-500 text-white'
                }`}>
                  {callStatus === 'in-progress' ? 'Connected' :
                   callStatus === 'connecting' ? 'Connecting...' :
                   callStatus === 'ringing' ? 'Ringing...' : 'Ended'}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCall}
                disabled={callStatus === 'connecting'}
                className={`flex-1 ${
                  callStatus === 'in-progress'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                } text-white font-semibold h-12`}
                data-testid="button-call-customer"
              >
                {callStatus === 'connecting' ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : callStatus === 'in-progress' ? (
                  <>
                    <PhoneOff className="w-5 h-5 mr-2" />
                    End Call
                  </>
                ) : (
                  <>
                    <Phone className="w-5 h-5 mr-2" />
                    Call Customer
                  </>
                )}
              </Button>

              {callStatus === 'in-progress' && (
                <Button
                  onClick={toggleMute}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10 h-12"
                  data-testid="button-mute"
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Replies */}
        <div className="flex-shrink-0">
          <h3 className="text-sm font-semibold text-blue-200 mb-2">Quick Replies</h3>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_REPLIES.map((reply, index) => (
              <Button
                key={index}
                size="sm"
                variant="outline"
                onClick={() => handleQuickReply(reply)}
                className="text-xs border-white/20 text-slate-900 dark:text-white hover:bg-white/10 h-auto py-2 whitespace-normal text-left"
                data-testid={`button-quick-reply-${index}`}
              >
                {reply}
              </Button>
            ))}
          </div>
        </div>

        {/* Messages Thread */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <h3 className="text-sm font-semibold text-blue-200 mb-2 flex-shrink-0">Messages</h3>
          <div className="flex-1 overflow-y-auto bg-white/5 rounded-lg p-3 space-y-2 mb-3">
            {messages.length === 0 ? (
              <p className="text-blue-300 text-xs text-center py-4">No messages yet</p>
            ) : (
              messages.slice().reverse().map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2 rounded-lg max-w-[85%] ${
                    msg.direction === 'outbound'
                      ? 'bg-blue-600 ml-auto text-white'
                      : 'bg-white/20 text-white'
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {format(new Date(msg.timestamp), 'h:mm a')}
                  </p>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="flex gap-2 flex-shrink-0">
            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-blue-300/50 min-h-[44px] max-h-[80px]"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              data-testid="textarea-message"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isSending || !messageText.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white h-[44px] px-4"
              data-testid="button-send-message"
            >
              {isSending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
