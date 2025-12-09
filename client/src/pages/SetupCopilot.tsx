import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import {
  Send,
  Bot,
  User,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Phone,
  Mail,
  Globe,
  Sparkles,
  Settings,
  Zap,
  RefreshCw,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

interface ContextCategory {
  id: string;
  label: string;
  passCount: number;
  warnCount: number;
  failCount: number;
}

interface CopilotContext {
  tenantName: string;
  subdomain: string | null;
  planTier: string;
  overallStatus: string;
  categories: ContextCategory[];
  telephony: {
    status: string;
    phoneNumber: string | null;
  };
  email: {
    status: string;
  };
  website: {
    status: string;
    publicUrl: string | null;
  };
  gapCount: number;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pass" || status === "configured" || status === "healthy") {
    return (
      <Badge variant="default" className="bg-green-600 text-white">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        OK
      </Badge>
    );
  }
  if (status === "warn" || status === "misconfigured") {
    return (
      <Badge variant="default" className="bg-yellow-600 text-white">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Warning
      </Badge>
    );
  }
  return (
    <Badge variant="default" className="bg-red-600 text-white">
      <XCircle className="w-3 h-3 mr-1" />
      Not Set
    </Badge>
  );
}

function CategorySummary({ category }: { category: ContextCategory }) {
  const total = category.passCount + category.warnCount + category.failCount;
  const passPercent = total > 0 ? Math.round((category.passCount / total) * 100) : 0;
  
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{category.label}</span>
      <div className="flex items-center gap-2">
        {category.failCount > 0 && (
          <span className="text-xs text-red-500">{category.failCount} fail</span>
        )}
        {category.warnCount > 0 && (
          <span className="text-xs text-yellow-500">{category.warnCount} warn</span>
        )}
        <span className="text-xs text-green-500">{category.passCount} pass</span>
        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${passPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function SetupCopilot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hey! I'm your ServicePro Setup Copilot. Ask me anything about setting up your account - telephony, email, website, branding, or integrations. I'll give you step-by-step guidance tailored to your current configuration.",
      createdAt: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: contextData, isLoading: contextLoading, refetch: refetchContext } = useQuery<{
    ok: boolean;
    context: CopilotContext;
  }>({
    queryKey: ["/api/ai/setup-assistant/context"],
  });

  const context = contextData?.context;

  const sendMutation = useMutation({
    mutationFn: async ({ userText, currentMessages }: { userText: string; currentMessages: Message[] }) => {
      const conversationHistory = currentMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));
      
      conversationHistory.push({ role: "user", content: userText });

      const response = await apiRequest("POST", "/api/ai/setup-assistant", { messages: conversationHistory });

      return response as {
        ok: boolean;
        reply: string;
        debug?: { overallStatus: string; gapCount: number };
      };
    },
    onSuccess: (data) => {
      if (data.ok && data.reply) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    },
    onError: (error: any) => {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `Sorry, I encountered an error: ${error.message || "Please try again."}`,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || sendMutation.isPending) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date(),
    };
    
    const currentMessagesSnapshot = [...messages, userMessage];
    setMessages(currentMessagesSnapshot);
    setInputText("");

    sendMutation.mutate({ userText: text, currentMessages: messages });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const quickQuestions = [
    "How do I set up Twilio for SMS?",
    "What are the next 3 things I should configure?",
    "Why is my email showing warnings?",
    "How do I connect Google Calendar?",
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Setup Copilot</h1>
            <p className="text-sm text-muted-foreground">
              Your AI-powered configuration assistant
            </p>
          </div>
          <Badge variant="outline" className="ml-auto">
            Beta
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="h-[calc(100vh-200px)] flex flex-col">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  Chat with Copilot
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0">
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                      {messages.map((message) => (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className={`flex gap-3 ${
                            message.role === "user" ? "justify-end" : "justify-start"
                          }`}
                        >
                          {message.role === "assistant" && (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Bot className="w-4 h-4 text-primary" />
                            </div>
                          )}
                          <div
                            className={`max-w-[80%] rounded-lg px-4 py-3 ${
                              message.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            <span className="text-xs opacity-60 mt-1 block">
                              {message.createdAt.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          {message.role === "user" && (
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-primary-foreground" />
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {sendMutation.isPending && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                        <div className="bg-muted rounded-lg px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm text-muted-foreground">
                              Thinking...
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {messages.length === 1 && (
                  <div className="px-4 pb-2">
                    <p className="text-xs text-muted-foreground mb-2">Quick questions:</p>
                    <div className="flex flex-wrap gap-2">
                      {quickQuestions.map((q, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            setInputText(q);
                            inputRef.current?.focus();
                          }}
                          data-testid={`quick-question-${i}`}
                        >
                          {q}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask about setup, configuration, or troubleshooting..."
                      disabled={sendMutation.isPending}
                      className="flex-1"
                      data-testid="input-copilot-message"
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!inputText.trim() || sendMutation.isPending}
                      data-testid="button-send-copilot"
                    >
                      {sendMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Context Snapshot
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refetchContext()}
                    disabled={contextLoading}
                    data-testid="button-refresh-context"
                  >
                    <RefreshCw className={`w-4 h-4 ${contextLoading ? "animate-spin" : ""}`} />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {contextLoading && !context ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : context ? (
                  <>
                    <div>
                      <p className="font-medium">{context.tenantName}</p>
                      {context.subdomain && (
                        <p className="text-sm text-muted-foreground">
                          {context.subdomain}.serviceproapp.com
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {context.planTier} Plan
                      </Badge>
                      <StatusBadge status={context.overallStatus} />
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">Telephony</span>
                        </div>
                        <StatusBadge status={context.telephony.status} />
                      </div>
                      {context.telephony.phoneNumber && (
                        <p className="text-xs text-muted-foreground pl-6">
                          {context.telephony.phoneNumber}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">Email</span>
                        </div>
                        <StatusBadge status={context.email.status} />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">Website</span>
                        </div>
                        <StatusBadge status={context.website.status} />
                      </div>
                      {context.website.publicUrl && (
                        <a
                          href={context.website.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline pl-6 block"
                        >
                          {context.website.publicUrl}
                        </a>
                      )}
                    </div>

                    {context.gapCount > 0 && (
                      <>
                        <Separator />
                        <div className="flex items-center gap-2 text-yellow-600">
                          <Zap className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {context.gapCount} configuration gap{context.gapCount !== 1 ? "s" : ""} detected
                          </span>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Unable to load context. Please refresh.
                  </p>
                )}
              </CardContent>
            </Card>

            {context?.categories && context.categories.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Readiness
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="divide-y">
                    {context.categories.map((cat) => (
                      <CategorySummary key={cat.id} category={cat} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
