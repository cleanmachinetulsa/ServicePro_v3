/**
 * CM-REWARDS-WELCOME-LANDING: Floating Chat Button
 * 
 * A minimal floating chat button for public pages.
 * Opens a chat dialog when clicked.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FloatingChatButtonProps {
  customerName?: string;
  customerPhone?: string;
}

export function FloatingChatButton({ customerName, customerPhone }: FloatingChatButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    setIsSending(true);
    
    try {
      const response = await fetch('/api/webchat/public-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          customerName,
          customerPhone,
          source: 'rewards-welcome'
        })
      });
      
      if (response.ok) {
        setSent(true);
        setMessage('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: 'spring', stiffness: 200 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className={`h-14 rounded-full shadow-lg transition-all duration-300 ${
            isOpen 
              ? 'bg-gray-700 hover:bg-gray-600 w-14' 
              : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-5 gap-2'
          }`}
          data-testid="button-chat-toggle"
        >
          {isOpen ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <>
              <MessageCircle className="w-5 h-5 text-white" />
              <span className="text-white font-medium hidden sm:inline">Chat</span>
            </>
          )}
        </Button>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 w-80 max-w-[calc(100vw-3rem)]"
          >
            <Card className="bg-white/95 backdrop-blur-xl border-purple-200/50 shadow-2xl">
              <CardHeader className="pb-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-t-lg">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Chat with Us
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {sent ? (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <MessageCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <p className="text-gray-700 font-medium">Message sent!</p>
                    <p className="text-sm text-gray-500 mt-1">We'll get back to you shortly.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setSent(false)}
                      data-testid="button-send-another"
                    >
                      Send another message
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">
                      Questions about your points or booking? We're here to help!
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type your message..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        disabled={isSending}
                        className="flex-1"
                        data-testid="input-chat-message"
                      />
                      <Button
                        onClick={handleSend}
                        disabled={isSending || !message.trim()}
                        className="bg-purple-600 hover:bg-purple-700"
                        data-testid="button-send-message"
                      >
                        {isSending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default FloatingChatButton;
