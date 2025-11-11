import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Device, Call } from '@twilio/voice-sdk';

interface Job {
  id: number;
  customerId: number;
  serviceId: number;
  scheduledTime: string;
  status: string;
  technicianId: number | null;
  customerPhone: string;
  customerName: string;
  customerAddress: string;
  latitude: string | null;
  longitude: string | null;
  jobNotes: string | null;
  statusUpdatedAt: string | null;
}

interface Message {
  id: number;
  conversationId: number;
  content: string;
  sender: string;
  timestamp: string;
  direction: 'inbound' | 'outbound';
}

interface QueuedAction {
  id: string;
  type: 'status_update' | 'send_message';
  payload: any;
  timestamp: number;
}

interface TechnicianContextType {
  jobs: Job[];
  selectedJob: Job | null;
  messages: Message[];
  isLoadingJobs: boolean;
  isLoadingMessages: boolean;
  isOnline: boolean;
  autoRefreshEnabled: boolean;
  device: Device | null;
  activeCall: Call | null;
  callStatus: 'idle' | 'connecting' | 'ringing' | 'in-progress' | 'disconnected';
  queuedActions: QueuedAction[];
  selectJob: (job: Job | null) => void;
  updateJobStatus: (status: string, notes?: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  makeCall: (phoneNumber: string) => Promise<void>;
  endCall: () => void;
  toggleAutoRefresh: () => void;
  refreshJobs: () => void;
}

const TechnicianContext = createContext<TechnicianContextType | undefined>(undefined);

interface TechnicianProviderProps {
  children: ReactNode;
  demoMode?: boolean;
  demoJobs?: Job[];
}

export function TechnicianProvider({ children, demoMode = false, demoJobs = [] }: TechnicianProviderProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [device, setDevice] = useState<Device | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'ringing' | 'in-progress' | 'disconnected'>('idle');
  const [queuedActions, setQueuedActions] = useState<QueuedAction[]>([]);

  // Fetch jobs with auto-refresh (skip if in demo mode)
  const { data: jobsData, isLoading: isLoadingJobs, refetch: refreshJobs } = useQuery<{ success: boolean; jobs: Job[] }>({
    queryKey: ['/api/tech/jobs/today'],
    refetchInterval: autoRefreshEnabled && !demoMode ? 60000 : false, // 60 seconds
    enabled: !demoMode, // Don't fetch if demo mode
  });

  // Use demo jobs if in demo mode, otherwise use real jobs
  const jobs = demoMode ? demoJobs : (jobsData?.jobs || []);

  // Fetch messages for selected job
  const { data: messagesData, isLoading: isLoadingMessages } = useQuery<{ success: boolean; messages: Message[] }>({
    queryKey: ['/api/tech/jobs', selectedJob?.id, 'messages'],
    enabled: !!selectedJob,
    refetchInterval: autoRefreshEnabled && !!selectedJob ? 30000 : false, // 30 seconds
  });

  const messages = messagesData?.messages || [];

  // Initialize Twilio Device
  useEffect(() => {
    const initDevice = async () => {
      try {
        const { token } = await apiRequest('POST', '/api/voice/token', {});
        const newDevice = new Device(token, {
          codecPreferences: ['opus', 'pcmu'],
          edge: 'roaming',
          logLevel: 1,
        });

        newDevice.on('registered', () => {
          console.log('[TECH] Twilio Device registered');
        });

        newDevice.on('error', (error) => {
          console.error('[TECH] Twilio Device error:', error);
        });

        await newDevice.register();
        setDevice(newDevice);
      } catch (error) {
        console.error('[TECH] Failed to initialize Twilio Device:', error);
      }
    };

    initDevice();

    return () => {
      if (device) {
        device.destroy();
      }
    };
  }, []);

  // Online/offline detection and queue processing
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      
      // Process queued actions when coming back online
      const savedQueue = localStorage.getItem('tech_queued_actions');
      if (savedQueue) {
        const queue: QueuedAction[] = JSON.parse(savedQueue);
        const failedActions: QueuedAction[] = [];
        
        for (const action of queue) {
          try {
            if (action.type === 'status_update') {
              await apiRequest('POST', `/api/tech/jobs/${action.payload.jobId}/status`, {
                status: action.payload.status,
                jobNotes: action.payload.notes,
              });
              // Invalidate jobs cache to refresh UI
              queryClient.invalidateQueries({ queryKey: ['/api/tech/jobs/today'] });
            } else if (action.type === 'send_message') {
              await apiRequest('POST', `/api/messages/send`, {
                customerPhone: action.payload.customerPhone,
                content: action.payload.content,
              });
              // Invalidate messages cache to refresh UI
              queryClient.invalidateQueries({ queryKey: ['/api/tech/jobs', action.payload.jobId, 'messages'] });
            }
            // Successfully synced - remove from queue
            setQueuedActions(prev => prev.filter(a => a.id !== action.id));
          } catch (error) {
            console.error('[TECH] Failed to sync queued action:', error);
            // Keep failed action in queue for retry
            failedActions.push(action);
          }
        }
        
        // Only save failed actions back to localStorage for retry
        if (failedActions.length > 0) {
          localStorage.setItem('tech_queued_actions', JSON.stringify(failedActions));
          setQueuedActions(failedActions);
        } else {
          localStorage.removeItem('tech_queued_actions');
          setQueuedActions([]);
        }
      }
    };
    
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load queued actions from localStorage on mount
    const savedQueue = localStorage.getItem('tech_queued_actions');
    if (savedQueue) {
      setQueuedActions(JSON.parse(savedQueue));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Persist selected job to localStorage
  useEffect(() => {
    if (selectedJob) {
      localStorage.setItem('tech_selected_job', JSON.stringify(selectedJob));
    }
  }, [selectedJob]);

  // Restore selected job from localStorage
  useEffect(() => {
    const savedJob = localStorage.getItem('tech_selected_job');
    if (savedJob && jobs.length > 0) {
      const parsedJob = JSON.parse(savedJob);
      const matchingJob = jobs.find(j => j.id === parsedJob.id);
      if (matchingJob) {
        setSelectedJob(matchingJob);
      }
    } else if (jobs.length === 1 && !selectedJob) {
      // Auto-select if only one job
      setSelectedJob(jobs[0]);
    }
  }, [jobs]);

  // Update job status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, notes }: { status: string; notes?: string }) => {
      if (!selectedJob) throw new Error('No job selected');
      return apiRequest('POST', `/api/tech/jobs/${selectedJob.id}/status`, {
        status,
        jobNotes: notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tech/jobs/today'] });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedJob) throw new Error('No job selected');
      return apiRequest('POST', `/api/messages/send`, {
        customerPhone: selectedJob.customerPhone,
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tech/jobs', selectedJob?.id, 'messages'] });
    },
  });

  const selectJob = (job: Job | null) => {
    setSelectedJob(job);
  };

  const updateJobStatus = async (status: string, notes?: string) => {
    if (!isOnline) {
      // Queue for later if offline - use functional update for atomicity
      const queuedAction: QueuedAction = {
        id: `status_${Date.now()}`,
        type: 'status_update',
        payload: { status, notes, jobId: selectedJob?.id },
        timestamp: Date.now(),
      };
      setQueuedActions(prev => {
        const newQueue = [...prev, queuedAction];
        localStorage.setItem('tech_queued_actions', JSON.stringify(newQueue));
        return newQueue;
      });
      // Return success - action was queued
      return Promise.resolve();
    }
    
    await updateStatusMutation.mutateAsync({ status, notes });
  };

  const sendMessage = async (content: string) => {
    if (!isOnline) {
      // Queue for later if offline - use functional update for atomicity
      const queuedAction: QueuedAction = {
        id: `message_${Date.now()}`,
        type: 'send_message',
        payload: { 
          content, 
          customerPhone: selectedJob?.customerPhone,
          jobId: selectedJob?.id  // Save jobId for cache invalidation
        },
        timestamp: Date.now(),
      };
      setQueuedActions(prev => {
        const newQueue = [...prev, queuedAction];
        localStorage.setItem('tech_queued_actions', JSON.stringify(newQueue));
        return newQueue;
      });
      // Return success - message was queued
      return Promise.resolve();
    }
    
    await sendMessageMutation.mutateAsync(content);
  };

  const makeCall = async (phoneNumber: string) => {
    if (!device) {
      window.location.href = `tel:${phoneNumber}`;
      return;
    }

    try {
      setCallStatus('connecting');
      const call = await device.connect({
        params: { To: phoneNumber },
      });

      setActiveCall(call);

      call.on('accept', () => {
        setCallStatus('in-progress');
      });

      call.on('disconnect', () => {
        setCallStatus('disconnected');
        setActiveCall(null);
        setTimeout(() => setCallStatus('idle'), 2000);
      });

      call.on('cancel', () => {
        setCallStatus('idle');
        setActiveCall(null);
      });

      call.on('reject', () => {
        setCallStatus('idle');
        setActiveCall(null);
      });

      call.on('error', () => {
        setCallStatus('idle');
        setActiveCall(null);
      });
    } catch (error) {
      console.error('[TECH] Call failed:', error);
      setCallStatus('idle');
      window.location.href = `tel:${phoneNumber}`;
    }
  };

  const endCall = () => {
    if (activeCall) {
      activeCall.disconnect();
    }
  };

  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(!autoRefreshEnabled);
  };

  return (
    <TechnicianContext.Provider
      value={{
        jobs,
        selectedJob,
        messages,
        isLoadingJobs,
        isLoadingMessages,
        isOnline,
        autoRefreshEnabled,
        device,
        activeCall,
        callStatus,
        queuedActions,
        selectJob,
        updateJobStatus,
        sendMessage,
        makeCall,
        endCall,
        toggleAutoRefresh,
        refreshJobs,
      }}
    >
      {children}
    </TechnicianContext.Provider>
  );
}

export function useTechnician() {
  const context = useContext(TechnicianContext);
  if (!context) {
    throw new Error('useTechnician must be used within TechnicianProvider');
  }
  return context;
}
