import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Bell, FileText, MessageCircle, Calendar, PhoneIncoming, X, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ActionableItem {
  id: number;
  customerName: string;
  issueDescription?: string;
  damageType?: string;
  createdAt?: string;
  status?: string;
  channel?: string;
  updatedAt?: string;
  appointmentDate?: string;
  serviceType?: string;
  depositRequired?: boolean;
  depositPaid?: boolean;
}

interface MissedCall {
  id: number;
  callSid: string;
  from: string;
  to: string;
  status: string;
  createdAt: string;
  conversationId: number | null;
}

interface ActionableItemsData {
  pendingQuotes: ActionableItem[];
  unreadCount: number;
  unreadConversations: ActionableItem[];
  pendingConfirmations: ActionableItem[];
  missedCalls: MissedCall[];
  totalActionableItems: number;
}

export function ActionableNotificationsBanner() {
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const { data, isLoading } = useQuery<{ success: boolean; data: ActionableItemsData }>({
    queryKey: ['/api/dashboard/actionable-items'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const actionableData = data?.data;

  // If user dismissed or no actionable items, don't show
  if (dismissed || !actionableData || actionableData.totalActionableItems === 0 || isLoading) {
    return null;
  }

  const { pendingQuotes, unreadCount, pendingConfirmations, missedCalls } = actionableData;

  return (
    <div className="w-full animate-in slide-in-from-top-4 duration-500">
      <Card className="border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 shadow-lg">
        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="mt-1">
                <Bell className="w-6 h-6 text-orange-600 dark:text-orange-400 animate-pulse" />
              </div>
              
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  <h3 className="font-semibold text-lg text-orange-900 dark:text-orange-100">
                    {actionableData.totalActionableItems} Item{actionableData.totalActionableItems > 1 ? 's' : ''} Need Your Attention
                  </h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Missed Calls */}
                  {missedCalls.length > 0 && (
                    <button
                      onClick={() => setLocation('/messages')}
                      className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border-2 border-red-200 dark:border-red-900 hover:border-red-400 dark:hover:border-red-700 transition-all group text-left"
                      data-testid="alert-missed-calls"
                    >
                      <div className="bg-red-100 dark:bg-red-900 p-2 rounded-lg group-hover:scale-110 transition-transform">
                        <PhoneIncoming className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {missedCalls.length} Missed Call{missedCalls.length > 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Customers need callback
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400 group-hover:translate-x-1 transition-all" />
                    </button>
                  )}

                  {/* Pending Quote Requests */}
                  {pendingQuotes.length > 0 && (
                    <button
                      onClick={() => setLocation('/quotes')}
                      className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border-2 border-orange-200 dark:border-orange-900 hover:border-orange-400 dark:hover:border-orange-700 transition-all group text-left"
                      data-testid="alert-pending-quotes"
                    >
                      <div className="bg-orange-100 dark:bg-orange-900 p-2 rounded-lg group-hover:scale-110 transition-transform">
                        <FileText className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {pendingQuotes.length} Quote Request{pendingQuotes.length > 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Specialty jobs waiting for pricing
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
                    </button>
                  )}

                  {/* Unread Messages */}
                  {unreadCount > 0 && (
                    <button
                      onClick={() => setLocation('/messages')}
                      className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border-2 border-blue-200 dark:border-blue-900 hover:border-blue-400 dark:hover:border-blue-700 transition-all group text-left"
                      data-testid="alert-unread-messages"
                    >
                      <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg group-hover:scale-110 transition-transform">
                        <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {unreadCount} Unread Message{unreadCount > 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Customers waiting for response
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                    </button>
                  )}

                  {/* Pending Confirmations */}
                  {pendingConfirmations.length > 0 && (
                    <button
                      onClick={() => setLocation('/dashboard?tab=customers')}
                      className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border-2 border-purple-200 dark:border-purple-900 hover:border-purple-400 dark:hover:border-purple-700 transition-all group text-left"
                      data-testid="alert-pending-confirmations"
                    >
                      <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg group-hover:scale-110 transition-transform">
                        <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {pendingConfirmations.length} Pending Deposit{pendingConfirmations.length > 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Awaiting customer payment
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Dismiss button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDismissed(true)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex-shrink-0"
              data-testid="button-dismiss-notifications"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
