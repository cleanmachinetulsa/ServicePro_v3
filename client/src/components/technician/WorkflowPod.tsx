import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle, Mic } from 'lucide-react';
import { useTechnician } from '@/contexts/TechnicianContext';
import { useToast } from '@/hooks/use-toast';

const STATUS_WORKFLOW = [
  { value: 'assigned', label: 'Assigned', color: 'bg-gray-500' },
  { value: 'en_route', label: 'En Route', color: 'bg-blue-500' },
  { value: 'on_site', label: 'On-Site', color: 'bg-purple-500' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-500' },
  { value: 'paused', label: 'Paused', color: 'bg-orange-500' },
  { value: 'completed', label: 'Completed', color: 'bg-green-500' },
] as const;

export function WorkflowPod() {
  const { selectedJob, updateJobStatus } = useTechnician();
  const [notes, setNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (selectedJob?.jobNotes) {
      setNotes(selectedJob.jobNotes);
    } else {
      setNotes('');
    }
  }, [selectedJob?.id]);

  // Auto-save notes every 10 seconds
  useEffect(() => {
    if (!selectedJob || !notes || notes === selectedJob.jobNotes) return;

    const timer = setTimeout(() => {
      handleSaveNotes();
    }, 10000);

    return () => clearTimeout(timer);
  }, [notes, selectedJob]);

  const handleStatusChange = async (status: string) => {
    if (!selectedJob) return;

    setIsUpdating(true);
    try {
      await updateJobStatus(status, notes);
      toast({
        title: 'Status Updated',
        description: `Job status changed to ${status}`,
      });
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update status',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedJob || !notes) return;

    setIsSavingNotes(true);
    try {
      await updateJobStatus(selectedJob.status || 'assigned', notes);
      toast({
        title: 'Notes Saved',
        description: 'Technician notes updated',
      });
    } catch (error: any) {
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save notes',
        variant: 'destructive',
      });
    } finally {
      setIsSavingNotes(false);
    }
  };

  const startVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
      toast({
        title: 'Not Supported',
        description: 'Voice input not available on this device',
        variant: 'destructive',
      });
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setNotes(prev => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.onerror = () => {
      toast({
        title: 'Voice Error',
        description: 'Failed to capture voice input',
        variant: 'destructive',
      });
    };

    recognition.start();
    toast({
      title: 'Listening...',
      description: 'Speak now',
    });
  };

  if (!selectedJob) {
    return (
      <Card className="h-full bg-white/5 border-white/10">
        <CardContent className="flex items-center justify-center h-full">
          <p className="text-blue-300 text-sm">Select a job to manage workflow</p>
        </CardContent>
      </Card>
    );
  }

  const currentStatusIndex = STATUS_WORKFLOW.findIndex(s => s.value === selectedJob.status);

  return (
    <Card className="h-full flex flex-col bg-white/5 border-white/10">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-white text-lg">Job Workflow</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-6">
        {/* Status Pipeline */}
        <div>
          <h3 className="text-sm font-semibold text-blue-200 mb-3">Status Progress</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {STATUS_WORKFLOW.map((statusItem, index) => {
              const isCompleted = index < currentStatusIndex;
              const isCurrent = statusItem.value === selectedJob.status;

              return (
                <Button
                  key={statusItem.value}
                  size="sm"
                  onClick={() => handleStatusChange(statusItem.value)}
                  disabled={isUpdating}
                  className={`h-auto py-3 flex flex-col items-center gap-1 ${
                    isCurrent ? statusItem.color + ' text-white hover:opacity-90' :
                    isCompleted ? statusItem.color + ' text-white opacity-60' :
                    'bg-white/10 text-blue-300 hover:bg-white/20'
                  }`}
                  data-testid={`button-status-${statusItem.value}`}
                >
                  {isCompleted && <CheckCircle className="w-4 h-4" />}
                  <span className="text-xs font-semibold">{statusItem.label}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Technician Notes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-blue-200">Technician Notes</h3>
            {isSavingNotes && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </span>
            )}
          </div>
          <div className="space-y-2">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this job (auto-saves every 10 seconds)..."
              className="min-h-[120px] bg-white/10 border-white/20 text-white placeholder:text-blue-300/50 resize-none"
              data-testid="textarea-job-notes"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={isSavingNotes || !notes}
                className="flex-1"
                data-testid="button-save-notes"
              >
                {isSavingNotes ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Notes'
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={startVoiceInput}
                className="border-white/20 text-white hover:bg-white/10"
                data-testid="button-voice-input"
              >
                <Mic className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Job Details */}
        <div>
          <h3 className="text-sm font-semibold text-blue-200 mb-2">Job Details</h3>
          <div className="bg-white/5 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-300">Customer:</span>
              <span className="text-white font-medium">{selectedJob.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-300">Phone:</span>
              <span className="text-white font-medium">{selectedJob.customerPhone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-300">Address:</span>
              <span className="text-white font-medium text-right ml-2">{selectedJob.customerAddress}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
