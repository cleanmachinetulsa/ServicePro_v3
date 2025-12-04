import { Voicemail, Play, Bot, AlertCircle, Sparkles } from "lucide-react";
import { getProxiedAudioUrl } from "@/lib/twilioMediaProxy";

type NightOpsVoicemailCardProps = {
  fromLabel: string;
  createdAt: string;
  transcription?: string | null;
  recordingUrl?: string | null;
  aiReplied?: boolean;
  // AI-generated voicemail intelligence (Phone Intelligence v1)
  aiSummary?: string | null;
  aiPriority?: 'HIGH' | 'NORMAL' | null;
};

export const NightOpsVoicemailCard: React.FC<NightOpsVoicemailCardProps> = ({
  fromLabel,
  createdAt,
  transcription,
  recordingUrl,
  aiReplied,
  aiSummary,
  aiPriority,
}) => {
  return (
    <div className={`mb-3 rounded-2xl border px-3.5 py-3 text-xs text-slate-200 ${
      aiPriority === 'HIGH' 
        ? 'border-red-500/40 bg-slate-950/80 shadow-[0_0_24px_rgba(239,68,68,0.25)]' 
        : 'border-cyan-500/30 bg-slate-950/80 shadow-[0_0_24px_rgba(34,211,238,0.25)]'
    }`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2">
          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ring-1 ${
            aiPriority === 'HIGH'
              ? 'bg-red-500/20 text-red-300 ring-red-500/40'
              : 'bg-cyan-500/20 text-cyan-300 ring-cyan-500/40'
          }`}>
            {aiPriority === 'HIGH' ? <AlertCircle className="h-4 w-4" /> : <Voicemail className="h-4 w-4" />}
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className={`text-[0.7rem] font-semibold uppercase tracking-[0.16em] ${
                aiPriority === 'HIGH' ? 'text-red-300' : 'text-cyan-300'
              }`}>
                {aiPriority === 'HIGH' ? 'Urgent Voicemail' : 'Voicemail'}
              </span>
              {aiPriority === 'HIGH' && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[0.55rem] font-medium text-red-300 ring-1 ring-red-500/40">
                  Needs Callback
                </span>
              )}
            </div>
            <span className="text-[0.65rem] text-slate-400">
              from {fromLabel}
            </span>
          </div>
        </div>
        <span className="text-[0.6rem] text-slate-500">{createdAt}</span>
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div className="mb-3 p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30">
          <div className="flex items-start gap-2">
            <Sparkles className="h-3.5 w-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[0.6rem] font-medium text-purple-400 uppercase tracking-wide mb-0.5">AI Summary</p>
              <p className="text-[0.75rem] leading-relaxed text-slate-200">{aiSummary}</p>
            </div>
          </div>
        </div>
      )}

      {transcription && (
        <div className="mb-3 p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/40">
          <p className="text-[0.75rem] leading-relaxed text-slate-200 italic">
            "{transcription}"
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        {recordingUrl ? (
          <a
            href={getProxiedAudioUrl(recordingUrl) || '#'}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-cyan-500/15 px-3 py-1.5 text-[0.7rem] font-medium text-cyan-300 ring-1 ring-cyan-500/50 hover:bg-cyan-500/25 transition-all duration-200 hover:shadow-[0_0_12px_rgba(34,211,238,0.3)]"
            data-testid="voicemail-play-button"
          >
            <Play className="h-3 w-3" />
            <span>Play recording</span>
          </a>
        ) : (
          <span className="text-[0.65rem] text-slate-500">
            Recording link unavailable
          </span>
        )}

        {aiReplied && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[0.65rem] font-medium text-emerald-300 ring-1 ring-emerald-500/40">
            <Bot className="h-3 w-3" />
            AI reply sent
          </span>
        )}
      </div>
    </div>
  );
};
