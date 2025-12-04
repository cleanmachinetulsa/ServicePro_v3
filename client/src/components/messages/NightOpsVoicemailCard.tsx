import { Voicemail, Play, Bot } from "lucide-react";
import { getProxiedAudioUrl } from "@/lib/twilioMediaProxy";

type NightOpsVoicemailCardProps = {
  fromLabel: string;
  createdAt: string;
  transcription?: string | null;
  recordingUrl?: string | null;
  aiReplied?: boolean;
};

export const NightOpsVoicemailCard: React.FC<NightOpsVoicemailCardProps> = ({
  fromLabel,
  createdAt,
  transcription,
  recordingUrl,
  aiReplied,
}) => {
  return (
    <div className="mb-3 rounded-2xl border border-cyan-500/30 bg-slate-950/80 px-3.5 py-3 text-xs text-slate-200 shadow-[0_0_24px_rgba(34,211,238,0.25)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40">
            <Voicemail className="h-4 w-4" />
          </span>
          <div className="flex flex-col">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-cyan-300">
              Voicemail
            </span>
            <span className="text-[0.65rem] text-slate-400">
              from {fromLabel}
            </span>
          </div>
        </div>
        <span className="text-[0.6rem] text-slate-500">{createdAt}</span>
      </div>

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
