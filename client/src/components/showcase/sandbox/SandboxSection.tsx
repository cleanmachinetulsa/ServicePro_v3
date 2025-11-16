import { useState } from 'react';
import { motion } from 'framer-motion';
import { SectionHeader } from '../shared/SectionHeader';
import { PillTabs } from '../shared/PillTabs';
import { SandboxChat } from './SandboxChat';
import { SandboxTimeline } from './SandboxTimeline';
import { useSandboxState } from './useSandboxState';
import { MODES, SandboxMode } from './sandboxConfig';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

export function SandboxSection() {
  const [mode, setMode] = useState<SandboxMode>('new-lead');
  const { messages, events, processMessage, reset } = useSandboxState(mode);

  const handleModeChange = (newMode: string) => {
    setMode(newMode as SandboxMode);
    setTimeout(reset, 100); // Reset after mode change with slight delay
  };

  const handleReset = () => {
    reset();
  };

  return (
    <section id="sandbox" className="py-24 relative bg-gradient-to-b from-transparent via-indigo-950/30 to-transparent">
      <div className="container mx-auto px-4">
        <SectionHeader
          badge="Try It Yourself"
          title="Live Interactive Sandbox"
          subtitle="Experience Clean Machine's AI automation firsthand - no signup required"
        />

        {/* Mode selector */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-4 flex-wrap mb-6">
            <PillTabs
              tabs={MODES.map(m => ({ id: m.id, label: m.label }))}
              activeTab={mode}
              onChange={handleModeChange}
            />
            <Button
              onClick={handleReset}
              variant="outline"
              size="sm"
              className="border-blue-400/50 bg-white/5 hover:bg-white/10 text-blue-200"
              data-testid="button-reset"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
          
          <motion.p
            key={mode}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-blue-200 max-w-2xl mx-auto"
          >
            {mode === 'free' && 'Ask anything! Try booking questions, pricing, or availability.'}
            {mode === 'new-lead' && 'Watch a complete booking flow from first contact to confirmed appointment.'}
            {mode === 'rain-reschedule' && 'See how weather automation handles rescheduling gracefully.'}
            {mode === 'follow-up' && 'Experience post-service follow-ups and review requests.'}
            {mode === 'upsell' && 'See how smart upselling works without being pushy.'}
          </motion.p>
        </div>

        {/* Sandbox grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Chat interface */}
          <motion.div
            key={`chat-${mode}`}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <SandboxChat
              mode={mode}
              messages={messages}
              onSendMessage={processMessage}
              onReset={reset}
            />
          </motion.div>

          {/* Automation timeline */}
          <motion.div
            key={`timeline-${mode}`}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <SandboxTimeline events={events} />
          </motion.div>
        </div>

        {/* Info footer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <div className="inline-block bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-cyan-600/10 backdrop-blur-sm border border-white/20 rounded-2xl px-8 py-6 max-w-3xl">
            <p className="text-blue-100 leading-relaxed">
              <strong className="text-white">This is a simplified demo.</strong> The real Clean Machine uses GPT-4o for 
              natural conversations, connects to your actual calendar, sends real SMS/emails, and handles 
              complex scenarios. This sandbox shows the <em>type</em> of intelligence you get, not the full depth.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
