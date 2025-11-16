import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, RotateCcw, Copy } from 'lucide-react';
import { Message, SandboxMode, QUICK_SUGGESTIONS } from './sandboxConfig';
import { useToast } from '@/hooks/use-toast';

interface SandboxChatProps {
  mode: SandboxMode;
  messages: Message[];
  onSendMessage: (text: string) => void;
  onReset?: () => void;
}

// Typing animation hook
function useTypingAnimation(text: string, enabled: boolean) {
  const [displayText, setDisplayText] = useState('');
  
  useEffect(() => {
    if (!enabled) {
      setDisplayText(text);
      return;
    }
    
    let currentIndex = 0;
    setDisplayText('');
    
    const interval = setInterval(() => {
      if (currentIndex <= text.length) {
        setDisplayText(text.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 20); // Fast typing speed
    
    return () => clearInterval(interval);
  }, [text, enabled]);
  
  return displayText;
}

function MessageBubble({ message, showTyping }: { message: Message; showTyping: boolean }) {
  const displayText = useTypingAnimation(message.text, showTyping && message.sender === 'agent');
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`flex ${message.sender === 'customer' ? 'justify-start' : 'justify-end'}`}
    >
      <div className={`max-w-[80%] md:max-w-[70%] ${
        message.sender === 'customer'
          ? 'bg-white/10 text-blue-100 rounded-2xl rounded-tl-md'
          : 'bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-2xl rounded-tr-md'
      } px-4 py-3 shadow-lg`}>
        <p className="text-sm leading-relaxed">{displayText || message.text}</p>
        <p className="text-xs opacity-60 mt-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </motion.div>
  );
}

export function SandboxChat({ mode, messages, onSendMessage, onReset }: SandboxChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showTypingForLast, setShowTypingForLast] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(messages.length);
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    
    // Show typing indicator and animation when agent responds
    if (messages.length > prevMessagesLength.current) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === 'agent') {
        setIsTyping(true);
        setShowTypingForLast(true);
        setTimeout(() => {
          setIsTyping(false);
        }, Math.min(lastMessage.text.length * 20, 800));
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    onSendMessage(inputValue);
    setInputValue('');
  };

  const handleSuggestionClick = (suggestion: string) => {
    onSendMessage(suggestion);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = QUICK_SUGGESTIONS[mode];

  const handleReset = () => {
    if (onReset) {
      onReset();
      toast({
        title: "Conversation reset",
        description: "Starting fresh!",
      });
    }
  };

  const handleCopy = () => {
    const conversationText = messages
      .map(m => `[${m.sender}]: ${m.text}`)
      .join('\n');
    navigator.clipboard.writeText(conversationText);
    toast({
      title: "Copied!",
      description: "Conversation copied to clipboard",
    });
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-900/80 to-blue-900/80 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden">
      {/* Chat header */}
      <div className="px-6 py-4 bg-white/5 border-b border-white/10 flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-lg">
          <Bot className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-white font-semibold">Clean Machine Agent</h3>
          <p className="text-xs text-blue-200">Always available</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Copy conversation"
            data-testid="button-copy-chat"
          >
            <Copy className="w-4 h-4 text-blue-300" />
          </button>
          {onReset && (
            <button
              onClick={handleReset}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Reset conversation"
              data-testid="button-reset-chat"
            >
              <RotateCcw className="w-4 h-4 text-blue-300" />
            </button>
          )}
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ minHeight: '400px', maxHeight: '500px' }}>
        <AnimatePresence mode="popLayout">
          {messages.map((message, i) => (
            <MessageBubble 
              key={message.id} 
              message={message} 
              showTyping={i === messages.length - 1 && showTypingForLast}
            />
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex justify-end"
            >
              <div className="bg-gradient-to-br from-blue-600/50 to-purple-600/50 rounded-2xl rounded-tr-md px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 bg-white rounded-full"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
                <span className="text-xs text-white/70">typing...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Quick suggestions */}
      {suggestions && suggestions.length > 0 && (
        <div className="px-6 pb-3">
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-sm text-blue-100 transition-all duration-200"
                data-testid={`suggestion-${i}`}
              >
                {suggestion}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="px-6 py-4 bg-white/5 border-t border-white/10">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-blue-200/50 focus:border-blue-400"
            data-testid="input-message"
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
