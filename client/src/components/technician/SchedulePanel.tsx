import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, CloudOff, TestTube2, Sun, Cloud, CloudRain } from 'lucide-react';
import { useTechnician } from '@/contexts/TechnicianContext';
import { format } from 'date-fns';

interface SchedulePanelProps {
  demoMode: boolean;
  onToggleDemo: () => void;
}

export function SchedulePanel({ demoMode, onToggleDemo }: SchedulePanelProps) {
  const { jobs, selectedJob, selectJob, isLoadingJobs, isOnline, autoRefreshEnabled, toggleAutoRefresh, refreshJobs } = useTechnician();

  const completedJobs = jobs.filter(j => j.status === 'completed').length;

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-y-auto">
      {/* Day Overview Card */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-4 text-white">
        <h3 className="text-sm font-semibold mb-3 text-blue-200">Today's Overview</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-blue-300">Jobs Completed</span>
            <span className="font-bold">{completedJobs}/{jobs.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-blue-300">Status</span>
            <span className={`text-xs px-2 py-0.5 rounded ${isOnline ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </Card>

      {/* Jobs List */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Today's Jobs ({jobs.length})</h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refreshJobs()}
            disabled={isLoadingJobs}
            className="text-white hover:bg-white/10"
            data-testid="button-refresh-jobs"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingJobs ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="space-y-2">
          {jobs.length === 0 ? (
            <Card className="bg-white/5 border-white/10 p-4 text-center">
              <p className="text-sm text-blue-300 mb-3">No jobs scheduled for today</p>
              <Button
                size="sm"
                onClick={onToggleDemo}
                variant={demoMode ? 'destructive' : 'default'}
                className="w-full"
                data-testid="button-toggle-demo"
              >
                <TestTube2 className="w-4 h-4 mr-2" />
                {demoMode ? 'Exit Demo Mode' : 'Try Demo Mode'}
              </Button>
            </Card>
          ) : (
            jobs.map((job) => (
              <button
                key={job.id}
                onClick={() => selectJob(job)}
                className={`w-full p-3 rounded-lg border transition-all text-left ${
                  selectedJob?.id === job.id
                    ? 'bg-blue-600 border-blue-400 shadow-lg'
                    : 'bg-white/10 border-white/20 hover:bg-white/15'
                }`}
                data-testid={`button-select-job-${job.id}`}
              >
                <div className="font-semibold text-white text-sm mb-1">
                  {job.customerName || 'Unknown Customer'}
                </div>
                <div className="text-xs text-blue-200">
                  {format(new Date(job.scheduledTime), 'h:mm a')}
                </div>
                <div className="mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    job.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                    job.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-300' :
                    job.status === 'en_route' ? 'bg-blue-500/20 text-blue-300' :
                    'bg-gray-500/20 text-gray-300'
                  }`}>
                    {job.status || 'scheduled'}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Quick Settings */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-4">
        <h3 className="text-sm font-semibold mb-3 text-blue-200">Quick Settings</h3>
        <div className="space-y-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleAutoRefresh}
            className="w-full justify-start text-white hover:bg-white/10"
            data-testid="button-toggle-refresh"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${autoRefreshEnabled ? 'text-green-400' : 'text-gray-400'}`} />
            Auto-Refresh: {autoRefreshEnabled ? 'On' : 'Off'}
          </Button>
          
          {!isOnline && (
            <div className="flex items-center gap-2 text-xs text-orange-300 bg-orange-500/10 p-2 rounded">
              <CloudOff className="w-4 h-4" />
              Working Offline
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
