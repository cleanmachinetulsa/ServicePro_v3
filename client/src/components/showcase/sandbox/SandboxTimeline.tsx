import { motion, AnimatePresence } from 'framer-motion';
import { TimelineEvent } from './sandboxConfig';
import { MessageSquare, Mail, Code2, Calendar, Tag, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface SandboxTimelineProps {
  events: TimelineEvent[];
}

const typeConfig = {
  sms: { icon: MessageSquare, color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  email: { icon: Mail, color: 'from-purple-500 to-pink-500', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  rule: { icon: Code2, color: 'from-yellow-500 to-orange-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  schedule: { icon: Calendar, color: 'from-green-500 to-emerald-500', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  tag: { icon: Tag, color: 'from-indigo-500 to-purple-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' }
};

export function SandboxTimeline({ events }: SandboxTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'simple' | 'advanced'>('simple');

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-900/80 to-indigo-900/80 backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-white/5 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold">Automation Timeline</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('simple')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'simple'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-blue-200 hover:bg-white/20'
              }`}
              data-testid="button-view-simple"
            >
              Simple
            </button>
            <button
              onClick={() => setViewMode('advanced')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'advanced'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-blue-200 hover:bg-white/20'
              }`}
              data-testid="button-view-advanced"
            >
              Advanced
            </button>
          </div>
        </div>
        <p className="text-xs text-blue-200">Live feed of automation events</p>
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3" style={{ minHeight: '400px', maxHeight: '500px' }}>
        <AnimatePresence mode="popLayout">
          {events.map((event, i) => {
            const config = typeConfig[event.type];
            const Icon = config.icon;
            const isExpanded = expandedId === event.id;

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ 
                  type: 'spring',
                  damping: 20,
                  stiffness: 300,
                  delay: i * 0.05 
                }}
                layout
              >
                <div
                  className={`${config.bg} border ${config.border} rounded-xl overflow-hidden hover:border-white/40 transition-all duration-200 cursor-pointer`}
                  onClick={() => setExpandedId(isExpanded ? null : event.id)}
                  data-testid={`event-${i}`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 bg-gradient-to-br ${config.color} rounded-lg flex-shrink-0`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-medium text-white truncate">
                            {event.message}
                          </span>
                          {event.details && viewMode === 'advanced' && (
                            <motion.div
                              animate={{ rotate: isExpanded ? 90 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronRight className="w-4 h-4 text-blue-300 flex-shrink-0" />
                            </motion.div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-blue-200/70">
                          <span className="uppercase font-medium">{event.type}</span>
                          <span>•</span>
                          <span>{event.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>

                    {/* Expanded details (advanced mode) */}
                    <AnimatePresence>
                      {isExpanded && event.details && viewMode === 'advanced' && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <p className="text-sm text-blue-100 font-mono">{event.details}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {events.length === 0 && (
          <div className="text-center py-12">
            <p className="text-blue-200/50">No events yet. Start chatting to see automation in action!</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-white/5 border-t border-white/10">
        <div className="flex items-center justify-between text-xs">
          <span className="text-blue-200/70">{events.length} events logged</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-400">Live</span>
          </div>
        </div>
      </div>
    </div>
  );
}
