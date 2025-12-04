import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  MessageCircle,
  PhoneCall,
  Sparkles,
  User2,
  X,
  PanelRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type NightOpsMessagesLayoutProps = {
  conversationList: React.ReactNode;
  threadView: React.ReactNode;
  contextPanel: React.ReactNode;
  showContextPanel?: boolean;
  onToggleContextPanel?: () => void;
  selectedConversationId?: number | null;
  headerActions?: React.ReactNode;
};

export const NightOpsMessagesLayout: React.FC<NightOpsMessagesLayoutProps> = ({
  conversationList,
  threadView,
  contextPanel,
  showContextPanel = true,
  onToggleContextPanel,
  selectedConversationId,
  headerActions,
}) => {
  const [mobileView, setMobileView] = useState<'inbox' | 'thread'>('inbox');
  const [showMobileContext, setShowMobileContext] = useState(false);

  const hasSelectedConversation = selectedConversationId !== null && selectedConversationId !== undefined;

  return (
    <div className="h-screen w-full bg-gradient-to-br from-slate-950 via-slate-950 to-black text-slate-100 flex flex-col">
      <header className="flex-shrink-0 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl z-40">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-3 py-2 md:px-6 md:py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-500/15 ring-1 ring-cyan-400/60 shadow-[0_0_18px_rgba(34,211,238,0.5)]">
              <Sparkles className="h-4 w-4 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">
                  Night Ops
                </span>
                <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[0.65rem] font-medium text-cyan-300 ring-1 ring-cyan-500/40">
                  Messaging Hub v2
                </span>
              </div>
              <h1 className="text-sm font-semibold text-slate-100 md:text-base">
                Conversations & Dispatch
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-6">
            <div className="hidden items-center gap-4 text-xs text-slate-400 lg:flex">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-cyan-300" />
                <span>Live threads</span>
              </div>
              <div className="flex items-center gap-2">
                <PhoneCall className="h-4 w-4 text-violet-300" />
                <span>Voice & Voicemail</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-300" />
                <span>AI Assist</span>
              </div>
            </div>
            {headerActions}
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto hidden max-w-[1800px] gap-4 px-3 py-4 md:px-6 md:py-4 lg:flex overflow-hidden">
        <motion.section
          layout
          className={cn(
            "nightops-panel nightops-scroll relative flex w-full flex-col overflow-hidden",
            "lg:w-[26%] min-w-[280px]"
          )}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          data-testid="night-ops-inbox-panel"
        >
          <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3">
            <div>
              <div className="nightops-section-title">Inbox</div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400/90 nightops-pulse" />
                <span>Live customers</span>
              </div>
            </div>
          </div>

          <div className="nightops-scroll flex-1 overflow-y-auto">
            {conversationList}
          </div>
        </motion.section>

        <motion.section
          layout
          className={cn(
            "nightops-panel nightops-scroll relative flex w-full flex-col overflow-hidden",
            showContextPanel ? "lg:w-[46%]" : "lg:w-[74%]"
          )}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          data-testid="night-ops-active-conversation"
        >
          <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="nightops-section-title">Thread</div>
              <span className="rounded-full bg-slate-900/70 px-2 py-0.5 text-[0.65rem] text-slate-400 ring-1 ring-slate-700/80">
                SMS · Voice · AI
              </span>
            </div>
            {hasSelectedConversation && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMobileContext(!showMobileContext)}
                className="lg:hidden text-slate-400 hover:text-cyan-300"
              >
                <User2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
            {threadView}
          </div>
        </motion.section>

        <AnimatePresence>
          {showContextPanel && (
            <motion.section
              layout
              className={cn(
                "nightops-panel nightops-scroll relative flex w-full flex-col overflow-hidden",
                "lg:w-[28%] min-w-[280px]"
              )}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              data-testid="night-ops-context-panel-wrapper"
            >
              <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3">
                <div>
                  <div className="nightops-section-title">Context</div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <User2 className="h-3.5 w-3.5 text-slate-300" />
                    <span>Customer · Vehicle · Jobs</span>
                  </div>
                </div>
              </div>

              <div className="nightops-scroll flex-1 overflow-y-auto px-4 py-3">
                {contextPanel}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <div className="lg:hidden flex-1 flex flex-col min-h-0">
        <AnimatePresence mode="wait">
          {mobileView === 'inbox' && (
            <motion.div
              key="mobile-inbox"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 min-h-0 flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3 bg-slate-950/80">
                <div>
                  <div className="nightops-section-title">Inbox</div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400/90 nightops-pulse" />
                    <span>Live customers</span>
                  </div>
                </div>
              </div>
              <div 
                className="flex-1 overflow-y-auto nightops-scroll px-2"
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('[data-conversation-id]')) {
                    setMobileView('thread');
                  }
                }}
              >
                {conversationList}
              </div>
            </motion.div>
          )}

          {mobileView === 'thread' && (
            <motion.div
              key="mobile-thread"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 min-h-0 flex flex-col bg-slate-950"
            >
              <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3 bg-slate-950/80">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMobileView('inbox')}
                    className="text-slate-400 hover:text-cyan-300 -ml-2"
                    data-testid="button-back-to-inbox"
                  >
                    ← Back
                  </Button>
                  <div className="nightops-section-title">Thread</div>
                </div>
                <Sheet open={showMobileContext} onOpenChange={setShowMobileContext}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-cyan-300"
                      data-testid="button-show-context-mobile"
                    >
                      <User2 className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent 
                    side="right" 
                    className="w-[85vw] max-w-[400px] bg-slate-950 border-slate-800 p-0"
                  >
                    <SheetHeader className="px-4 py-3 border-b border-slate-700/60">
                      <SheetTitle className="nightops-section-title text-slate-100">
                        Customer Context
                      </SheetTitle>
                    </SheetHeader>
                    <div className="nightops-scroll overflow-y-auto h-[calc(100vh-80px)] px-4 py-3">
                      {contextPanel}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
              <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
                {threadView}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
