import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  MessageCircle,
  PhoneCall,
  Sparkles,
  MapPin,
  Clock,
  User2,
  Info,
} from "lucide-react";

type NightOpsMessagesLayoutProps = {
  conversationList: React.ReactNode;
  threadView: React.ReactNode;
  contextPanel: React.ReactNode;
  showContextPanel?: boolean;
};

export const NightOpsMessagesLayout: React.FC<NightOpsMessagesLayoutProps> = ({
  conversationList,
  threadView,
  contextPanel,
  showContextPanel = true,
}) => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-950 to-black text-slate-100">
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-4 py-3 md:px-8">
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
                  Control Tower v1
                </span>
              </div>
              <h1 className="text-sm font-semibold text-slate-100 md:text-base">
                Conversations & Dispatch
              </h1>
            </div>
          </div>
          <div className="hidden items-center gap-6 text-xs text-slate-400 md:flex">
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
        </div>
      </header>

      <main className="mx-auto flex max-w-[1800px] flex-col gap-4 px-3 py-4 md:px-6 md:py-6 lg:flex-row">
        <motion.section
          layout
          className={cn(
            "nightops-panel nightops-scroll relative flex h-[70vh] w-full flex-col overflow-hidden md:h-[78vh] lg:h-[82vh]",
            "lg:w-[26%]"
          )}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
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

          <div className="nightops-scroll flex-1 overflow-y-auto px-2 py-2">
            {conversationList}
          </div>
        </motion.section>

        <motion.section
          layout
          className={cn(
            "nightops-panel nightops-scroll relative flex h-[72vh] w-full flex-col overflow-hidden md:h-[78vh] lg:h-[82vh]",
            showContextPanel ? "lg:w-[46%]" : "lg:w-[74%]"
          )}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="nightops-section-title">Thread</div>
              <span className="rounded-full bg-slate-900/70 px-2 py-0.5 text-[0.65rem] text-slate-400 ring-1 ring-slate-700/80">
                SMS · Voice · AI
              </span>
            </div>
            <div className="flex items-center gap-3 text-[0.7rem] text-slate-400">
              <div className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3 text-slate-500" />
                <span>Chronological</span>
              </div>
              <div className="inline-flex items-center gap-1">
                <Info className="h-3 w-3 text-cyan-400" />
                <span>AI assisted</span>
              </div>
            </div>
          </div>

          <div className="nightops-scroll flex-1 overflow-y-auto">
            {threadView}
          </div>
        </motion.section>

        {showContextPanel && (
          <motion.section
            layout
            className={cn(
              "nightops-panel nightops-scroll relative flex h-[40vh] w-full flex-col overflow-hidden md:h-[78vh] lg:h-[82vh]",
              "lg:w-[28%]"
            )}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3">
              <div>
                <div className="nightops-section-title">Context</div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <User2 className="h-3.5 w-3.5 text-slate-300" />
                  <span>Customer · Vehicle · Jobs</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[0.7rem] text-slate-400">
                <MapPin className="h-3 w-3 text-cyan-300" />
                <span>Route-aware</span>
              </div>
            </div>

            <div className="nightops-scroll flex-1 overflow-y-auto px-4 py-3">
              {contextPanel}
            </div>
          </motion.section>
        )}
      </main>
    </div>
  );
};
