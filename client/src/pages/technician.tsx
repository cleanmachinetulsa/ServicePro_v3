import { useState, useEffect, useRef } from 'react';
import { TechnicianProvider, useTechnician } from '@/contexts/TechnicianContext';
import { TechnicianLayout } from '@/components/technician/TechnicianLayout';
import { SchedulePanel } from '@/components/technician/SchedulePanel';
import { WorkflowPod } from '@/components/technician/WorkflowPod';
import { NavigationPod } from '@/components/technician/NavigationPod';
import { CommunicationsPod } from '@/components/technician/CommunicationsPod';
import { MediaPod } from '@/components/technician/MediaPod';
import { QuickActionsFooter } from '@/components/technician/QuickActionsFooter';
import { useToast } from '@/hooks/use-toast';
import { usePwa } from '@/contexts/PwaContext';
import { AlertCircle, Smartphone, Download, Maximize, X } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Technician PWA Install Prompt
function TechnicianInstallPrompt() {
  const { isInstallable, isInstalled, promptInstall } = usePwa();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show if already installed or dismissed
  if (isInstalled || !isInstallable || isDismissed) {
    return null;
  }

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 animate-in slide-in-from-top">
      <Card className="bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 text-white border-0 shadow-2xl backdrop-blur-lg">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Download className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-2">Install Technician App</h3>
              <p className="text-sm text-blue-50 mb-3">
                Get the best iPad experience with fullscreen mode, offline access, and instant access from your home screen
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-2 bg-white/10 rounded-lg p-2">
                  <Maximize className="h-4 w-4 flex-shrink-0" />
                  <span>Fullscreen Mode</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-lg p-2">
                  <Smartphone className="h-4 w-4 flex-shrink-0" />
                  <span>Works Offline</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-lg p-2">
                  <Download className="h-4 w-4 flex-shrink-0" />
                  <span>Quick Access</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/20 h-9 w-9 p-0"
                onClick={() => setIsDismissed(true)}
                data-testid="button-dismiss-technician-install"
              >
                <X className="h-5 w-5" />
              </Button>
              <Button
                size="sm"
                className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-6"
                onClick={promptInstall}
                data-testid="button-install-technician-app"
              >
                Install Now
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Demo data for when no real jobs exist
const DEMO_JOBS = [
  {
    id: 99901,
    customerId: 1,
    serviceId: 1,
    scheduledTime: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(),
    status: 'assigned',
    technicianId: null,
    customerPhone: '+1234567890',
    customerName: 'John Smith',
    customerAddress: '123 Main St, San Francisco, CA 94102',
    latitude: '37.7749',
    longitude: '-122.4194',
    jobNotes: null,
    statusUpdatedAt: null,
  },
  {
    id: 99902,
    customerId: 2,
    serviceId: 2,
    scheduledTime: new Date(new Date().setHours(13, 30, 0, 0)).toISOString(),
    status: 'en_route',
    technicianId: 1,
    customerPhone: '+1234567891',
    customerName: 'Sarah Johnson',
    customerAddress: '456 Oak Ave, San Francisco, CA 94103',
    latitude: '37.7699',
    longitude: '-122.4311',
    jobNotes: 'Customer prefers exterior detail only',
    statusUpdatedAt: new Date().toISOString(),
  },
  {
    id: 99903,
    customerId: 3,
    serviceId: 3,
    scheduledTime: new Date(new Date().setHours(15, 0, 0, 0)).toISOString(),
    status: 'scheduled',
    technicianId: null,
    customerPhone: '+1234567892',
    customerName: 'Mike Davis',
    customerAddress: '789 Pine St, San Francisco, CA 94104',
    latitude: '37.7899',
    longitude: '-122.4036',
    jobNotes: null,
    statusUpdatedAt: null,
  },
];

interface TechnicianContentProps {
  demoMode: boolean;
  onToggleDemo: (enabled: boolean) => void;
}

function TechnicianContent({ demoMode, onToggleDemo }: TechnicianContentProps) {
  const [showOrientationWarning, setShowOrientationWarning] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const { selectedJob, updateJobStatus, jobs, queuedActions, isOnline, makeCall } = useTechnician();
  const { toast } = useToast();
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Detect device orientation
  useEffect(() => {
    const checkOrientation = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      const isMobile = window.innerWidth < 768;
      setShowOrientationWarning(isPortrait && !isMobile);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Quick Actions
  const handleMarkOnSite = async () => {
    if (!selectedJob) {
      toast({
        title: 'No Job Selected',
        description: 'Please select a job first',
        variant: 'destructive',
      });
      return;
    }

    if (demoMode) {
      toast({
        title: 'Demo Mode',
        description: 'This action is disabled in demo mode',
      });
      return;
    }

    try {
      await updateJobStatus('on_site');
      toast({
        title: 'Status Updated',
        description: 'Marked as on-site',
      });
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const handleEmergencyCall = async () => {
    // Use WebRTC calling instead of FaceTime for iPad compatibility
    const officeNumber = '+19188565711';
    
    try {
      await makeCall(officeNumber);
      toast({
        title: 'Calling Office',
        description: 'Connecting via WebRTC...',
      });
    } catch (error) {
      console.error('Failed to make WebRTC call:', error);
      // Fallback to tel: link if WebRTC fails
      window.location.href = `tel:${officeNumber}`;
      toast({
        title: 'Call Failed',
        description: 'Trying traditional phone call instead',
        variant: 'destructive',
      });
    }
  };

  const handleQuickPhoto = () => {
    if (!selectedJob) {
      toast({
        title: 'No Job Selected',
        description: 'Please select a job first',
        variant: 'destructive',
      });
      return;
    }

    if (demoMode) {
      toast({
        title: 'Demo Mode',
        description: 'Photo upload is disabled in demo mode',
      });
      return;
    }

    // Trigger camera capture
    photoInputRef.current?.click();
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedJob) return;

    // Validate file type and size
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Invalid File Type',
        description: 'Please select a JPEG, PNG, or GIF image',
        variant: 'destructive',
      });
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        title: 'File Too Large',
        description: 'Image must be less than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingPhoto(true);
    
    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('jobId', selectedJob.id.toString());

      const response = await fetch('/api/upload-photo', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      toast({
        title: 'Photo Uploaded',
        description: 'Photo captured and uploaded successfully',
      });

      // Clear the input value so the same file can be selected again
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Photo upload error:', error);
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload photo. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleNextJob = () => {
    const currentIndex = jobs.findIndex(j => j.id === selectedJob?.id);
    const nextJob = jobs[currentIndex + 1];
    
    if (nextJob) {
      // This would integrate with useTechnician().selectJob()
      toast({
        title: 'Next Job',
        description: `Navigating to ${nextJob.customerName}`,
      });
    } else {
      toast({
        title: 'No More Jobs',
        description: 'This is the last job for today',
      });
    }
  };

  const handleToggleDemoMode = (enabled: boolean) => {
    onToggleDemo(enabled);
    if (enabled) {
      toast({
        title: 'Demo Mode Activated',
        description: '3 sample jobs loaded for preview',
      });
    } else {
      toast({
        title: 'Demo Mode Deactivated',
        description: 'Showing real jobs from your calendar',
      });
    }
  };

  return (
    <TechnicianLayout
      technicianName="Technician"
      technicianStatus={selectedJob ? 'on_job' : 'available'}
      shiftStart={format(new Date().setHours(8, 0, 0, 0), 'h:mm a')}
      jobsCompleted={jobs.filter(j => j.status === 'completed').length}
      totalJobs={jobs.length}
      demoMode={demoMode}
      onToggleDemo={onToggleDemo}
    >
      {/* PWA Install Prompt */}
      <TechnicianInstallPrompt />
      
      {/* Demo Mode Banner */}
      {demoMode && (
        <div className="bg-red-600 text-white px-4 py-2 text-center font-semibold flex items-center justify-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          🔴 DEMO MODE ACTIVE - Sample data for preview only
        </div>
      )}

      {/* Offline/Queue Banner */}
      {!isOnline && (
        <div className="bg-orange-600 text-white px-4 py-2 text-center font-semibold flex items-center justify-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          Working Offline {queuedActions.length > 0 && `- ${queuedActions.length} actions queued for sync`}
        </div>
      )}

      {/* Demo Actions Queue Display */}
      {demoMode && queuedActions.length > 0 && (
        <div className="px-4 py-3 bg-yellow-500/10 border-b border-yellow-500/30">
          <Card className="border-yellow-500/50 bg-yellow-500/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                <AlertCircle className="h-4 w-4" />
                Demo Actions Queued ({queuedActions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {queuedActions.slice(-3).map(action => (
                <div key={action.id} className="text-xs text-muted-foreground bg-white/50 dark:bg-black/20 rounded px-2 py-1">
                  {action.type === 'status_update' 
                    ? `Status → ${action.payload.status}`
                    : 'Message sent'}
                </div>
              ))}
              {queuedActions.length > 3 && (
                <div className="text-xs text-muted-foreground italic">
                  ...and {queuedActions.length - 3} more
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Orientation Warning */}
      {showOrientationWarning && (
        <div className="bg-orange-600 text-white px-4 py-2 text-center font-semibold flex items-center justify-center gap-2 text-sm">
          <Smartphone className="w-4 h-4" />
          Rotate device to landscape for best experience
        </div>
      )}

      {/* Main Layout */}
      <div className="h-full flex overflow-hidden">
        {/* Left Rail - Jobs Schedule */}
        <aside className="w-80 flex-shrink-0 bg-blue-900/50 border-r border-blue-800 hidden lg:block overflow-y-auto">
          <SchedulePanel demoMode={demoMode} onToggleDemo={handleToggleDemoMode} />
        </aside>

        {/* Main Canvas - 3 Pods Grid */}
        <main className="flex-1 overflow-y-auto pb-[60px]">
          <div className="h-full p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 h-full">
              {/* Workflow Pod */}
              <div className="min-h-[400px] lg:min-h-full">
                <WorkflowPod />
              </div>

              {/* Navigation Pod */}
              <div className="min-h-[400px] lg:min-h-full">
                <NavigationPod />
              </div>

              {/* Communications Pod */}
              <div className="min-h-[400px] lg:min-h-full">
                <CommunicationsPod />
              </div>

              {/* Media Pod - Full width on mobile, spans 2 cols on larger screens */}
              <div className="min-h-[400px] lg:min-h-full xl:col-span-3">
                <MediaPod />
              </div>
            </div>
          </div>
        </main>

        {/* Mobile Jobs Panel (Collapsible) */}
        <div className="lg:hidden fixed top-16 left-0 right-0 bg-blue-900/95 backdrop-blur-lg border-b border-blue-800 z-40 max-h-[50vh] overflow-y-auto">
          <SchedulePanel demoMode={demoMode} onToggleDemo={handleToggleDemoMode} />
        </div>
      </div>

      {/* Hidden camera input */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoCapture}
        className="hidden"
        data-testid="input-camera-capture"
      />

      {/* Quick Actions Footer */}
      <QuickActionsFooter
        onMarkOnSite={handleMarkOnSite}
        onEmergencyCall={handleEmergencyCall}
        onQuickPhoto={handleQuickPhoto}
        onNextJob={handleNextJob}
        disabled={!selectedJob || isUploadingPhoto}
      />
    </TechnicianLayout>
  );
}

export default function TechnicianPage() {
  const [demoMode, setDemoMode] = useState(() => {
    const saved = localStorage.getItem('technicianDemoMode');
    return saved === 'true';
  });
  const [hasAutoEnabled, setHasAutoEnabled] = useState(false);
  const [userPreferenceSet, setUserPreferenceSet] = useState(false);

  const toggleDemoMode = () => {
    setDemoMode(prev => {
      const newValue = !prev;
      localStorage.setItem('technicianDemoMode', String(newValue));
      return newValue;
    });
    setUserPreferenceSet(true);
  };

  return (
    <TechnicianProvider demoMode={demoMode} demoJobs={DEMO_JOBS}>
      <TechnicianContentWrapper 
        demoMode={demoMode} 
        toggleDemoMode={toggleDemoMode}
        hasAutoEnabled={hasAutoEnabled}
        setHasAutoEnabled={setHasAutoEnabled}
        userPreferenceSet={userPreferenceSet}
        setUserPreferenceSet={setUserPreferenceSet}
      />
    </TechnicianProvider>
  );
}

function TechnicianContentWrapper({ 
  demoMode, 
  toggleDemoMode,
  hasAutoEnabled,
  setHasAutoEnabled,
  userPreferenceSet,
  setUserPreferenceSet,
}: { 
  demoMode: boolean; 
  toggleDemoMode: () => void;
  hasAutoEnabled: boolean;
  setHasAutoEnabled: (val: boolean) => void;
  userPreferenceSet: boolean;
  setUserPreferenceSet: (val: boolean) => void;
}) {
  const { jobs, isLoadingJobs } = useTechnician();
  const { toast } = useToast();

  // Auto-enable demo mode ONCE when:
  // 1. Data has finished loading (not isLoading)
  // 2. No real jobs exist (jobs.length === 0)
  // 3. User hasn't set a preference yet (manual toggle)
  // 4. We haven't already auto-enabled
  useEffect(() => {
    if (!isLoadingJobs && !userPreferenceSet && !hasAutoEnabled && jobs.length === 0) {
      console.log('[TECH PAGE] No real jobs found - auto-enabling demo mode');
      toggleDemoMode();
      setHasAutoEnabled(true);
      toast({
        title: 'Demo Mode Activated',
        description: 'No scheduled jobs found. Showing 3 sample jobs for preview.',
      });
    }
    
    // If real jobs arrive, reset the auto-enable flag so demo can auto-enable again if jobs disappear
    if (jobs.length > 0 && hasAutoEnabled) {
      setHasAutoEnabled(false);
    }
  }, [isLoadingJobs, jobs.length, userPreferenceSet, hasAutoEnabled, toggleDemoMode, setHasAutoEnabled, toast]);

  const handleToggleDemo = (enabled: boolean) => {
    setDemoMode(enabled);
    localStorage.setItem('technicianDemoMode', String(enabled));
    if (enabled) {
      toast({
        title: 'Demo Mode Activated',
        description: '3 sample jobs loaded for preview',
      });
    } else {
      toast({
        title: 'Demo Mode Deactivated',
        description: 'Showing real jobs from your calendar',
      });
    }
  };

  return (
    <TechnicianContent demoMode={demoMode} onToggleDemo={handleToggleDemo} />
  );
}
