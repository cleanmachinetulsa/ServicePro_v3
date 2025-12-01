import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phone, History, Voicemail, Hash, Users } from 'lucide-react';
import Dialer from '@/components/phone/Dialer';
import RecentCalls from '@/components/phone/RecentCalls';
import VoicemailInbox from '@/components/phone/VoicemailInbox';
import ActiveCall from '@/components/phone/ActiveCall';
import CustomersPane from '@/components/phone/CustomersPane';
import { AppShell } from '@/components/AppShell';

export default function PhonePage() {
  const [activeTab, setActiveTab] = useState('dialer');

  // Check for active calls
  const { data: activeCallsData } = useQuery<{ calls?: Array<{ id: number }> }>({
    queryKey: ['/api/calls/active'],
    refetchInterval: 2000, // Poll every 2 seconds for active calls
  });

  const activeCalls = activeCallsData?.calls || [];
  const hasActiveCall = activeCalls.length > 0;

  // If there's an active call, show the active call overlay
  if (hasActiveCall) {
    return (
      <AppShell title="Phone" showSearch={false}>
        <ActiveCall 
          callId={activeCalls[0].id}
          onEnd={() => {
            // Call ended, page will refresh via query invalidation
          }}
        />
      </AppShell>
    );
  }

  // Normal phone interface with tabs
  return (
    <AppShell title="Phone" showSearch={false}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <div className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 px-2 sm:px-4">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-4 bg-gray-100 dark:bg-gray-800 h-10 sm:h-auto">
            <TabsTrigger 
              value="dialer" 
              className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
              data-testid="tab-dialer"
            >
              <Hash className="h-4 w-4" />
              <span className="hidden sm:inline">Dialer</span>
            </TabsTrigger>
            <TabsTrigger 
              value="recents" 
              className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
              data-testid="tab-recents"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Recents</span>
            </TabsTrigger>
            <TabsTrigger 
              value="customers" 
              className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
              data-testid="tab-customers"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Customers</span>
            </TabsTrigger>
            <TabsTrigger 
              value="voicemail" 
              className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
              data-testid="tab-voicemail"
            >
              <Voicemail className="h-4 w-4" />
              <span className="hidden sm:inline">Voicemail</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 min-h-0">
          <TabsContent value="dialer" className="h-full m-0">
            <Dialer />
          </TabsContent>

          <TabsContent value="recents" className="h-full m-0">
            <RecentCalls />
          </TabsContent>

          <TabsContent value="customers" className="h-full m-0">
            <CustomersPane />
          </TabsContent>

          <TabsContent value="voicemail" className="h-full m-0">
            <VoicemailInbox />
          </TabsContent>
        </div>
      </Tabs>
    </AppShell>
  );
}
