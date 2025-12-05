import React, { useState, useEffect } from 'react';
import { motion } from "framer-motion";
import MultiVehicleAppointmentScheduler from "@/components/MultiVehicleAppointmentScheduler";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Gift, Sparkles } from "lucide-react";

/**
 * Loyalty Redemption Journey v2
 * This page accepts reward context from the Customer Rewards Portal
 * via query params: ?rewardId=X&rewardName=Y&rewardPoints=Z&phone=...&name=...
 */
export default function SchedulePage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [prefilledData, setPrefilledData] = useState<{
    name?: string;
    phone?: string;
    service?: string;
    referralCode?: string;
    // Loyalty Redemption Journey v2 - reward context
    rewardId?: number;
    rewardName?: string;
    rewardPoints?: number;
  }>({});

  useEffect(() => {
    // Parse URL parameters for pre-filled reschedule flow, referral codes, and reward redemption
    const params = new URLSearchParams(window.location.search);
    const name = params.get('name');
    const phone = params.get('phone');
    const service = params.get('service');
    const referralCode = params.get('ref');
    
    // Loyalty Redemption Journey v2 - reward context from Rewards Portal
    const rewardId = params.get('rewardId');
    const rewardName = params.get('rewardName');
    const rewardPoints = params.get('rewardPoints');

    if (name || phone || service || referralCode || rewardId) {
      setPrefilledData({
        name: name || undefined,
        phone: phone || undefined,
        service: service || undefined,
        referralCode: referralCode || undefined,
        rewardId: rewardId ? Number(rewardId) : undefined,
        rewardName: rewardName || undefined,
        rewardPoints: rewardPoints ? Number(rewardPoints) : undefined,
      });
    }
  }, []);

  const handleAppointmentSuccess = (appointmentDetails: any) => {
    toast({
      title: "Appointment Scheduled",
      description: `Your ${appointmentDetails.service} appointment has been confirmed for ${appointmentDetails.formattedTime}.`,
    });

    // Redirect to success page or home
    setTimeout(() => {
      setLocation("/");
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-blue-950/10 to-black text-white overflow-hidden relative">
      {/* Premium background elements */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[10%] left-[15%] w-96 h-96 bg-blue-500/5 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-[20%] right-[10%] w-80 h-80 bg-blue-600/5 rounded-full filter blur-3xl"></div>
      </div>

      <div className="container mx-auto py-12 px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-4xl mx-auto"
        >
          {/* Glass-morphism container */}
          <div className="bg-gray-900/40 backdrop-blur-xl border border-blue-500/20 rounded-2xl shadow-2xl shadow-blue-500/10 overflow-hidden">
            {/* Header with gradient text */}
            <div className="p-8 pb-4 text-center">
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-3xl md:text-4xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-blue-200 via-blue-400 to-blue-200"
              >
                Schedule Your Detailing Service
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-blue-100/70 text-sm md:text-base max-w-2xl mx-auto"
              >
                Complete the form below to book your premium auto detailing service
              </motion.p>
            </div>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="px-6 pb-6"
            >
              {/* Loyalty Redemption Journey v2 - Using Reward Banner */}
              {prefilledData.rewardId && prefilledData.rewardName && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-md mx-auto mb-4"
                >
                  <div className="p-4 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-xl backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                        <Gift className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-purple-300" />
                          Using Reward
                        </p>
                        <p className="text-purple-200 text-sm truncate">
                          {prefilledData.rewardName} ({prefilledData.rewardPoints?.toLocaleString()} pts)
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-purple-300/70">
                      Complete your booking and we'll apply this reward at checkout.
                    </p>
                  </div>
                </motion.div>
              )}
              
              {(prefilledData.name || prefilledData.phone) && !prefilledData.rewardId && (
                <div className="max-w-md mx-auto mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    🌧️ <strong>Rescheduling due to weather?</strong> Your information has been pre-filled. Just select a new date!
                  </p>
                </div>
              )}
              <MultiVehicleAppointmentScheduler
                initialName={prefilledData.name}
                initialPhone={prefilledData.phone}
                initialService={prefilledData.service}
                initialReferralCode={prefilledData.referralCode}
                initialRewardId={prefilledData.rewardId}
                initialRewardName={prefilledData.rewardName}
                initialRewardPoints={prefilledData.rewardPoints}
                onClose={() => setLocation("/")}
                onSuccess={handleAppointmentSuccess}
              />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}