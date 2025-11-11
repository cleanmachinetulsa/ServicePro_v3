import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, XCircle, ExternalLink, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface PendingAssessment {
  appointment: {
    id: number;
    scheduledTime: string;
    damageDescription: string;
    damagePhotos: string[];
    assessmentRequestedAt: string;
    address: string;
  };
  service: {
    name: string;
    priceRange: string;
  };
  customer: {
    name: string;
    phone: string;
    email: string;
  };
}

export default function DamageAssessment() {
  const { toast } = useToast();
  
  // Fetch pending damage assessments
  const { data: assessmentsData, isLoading, error } = useQuery({
    queryKey: ['/api/appointments/damage-assessment/pending'],
  });
  
  // Show error toast if fetch fails (wrapped in useEffect to prevent infinite loop)
  useEffect(() => {
    if (error) {
      toast({
        title: "Error Loading Assessments",
        description: "Failed to fetch pending damage assessments. Please refresh the page.",
        variant: "destructive",
      });
    }
  }, [error, toast]);
  
  const pendingAssessments: PendingAssessment[] = assessmentsData?.appointments || [];
  
  // Mutation to update assessment status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ appointmentId, status }: { appointmentId: number; status: string }) => {
      const response = await fetch(`/api/appointments/${appointmentId}/damage-assessment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update assessment status');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/damage-assessment/pending'] });
      toast({
        title: "Status Updated",
        description: "Damage assessment status has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update assessment status. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  const handleApprove = (appointmentId: number) => {
    updateStatusMutation.mutate({ appointmentId, status: 'approved' });
  };
  
  const handleReject = (appointmentId: number) => {
    updateStatusMutation.mutate({ appointmentId, status: 'rejected' });
  };
  
  const getTimeWaiting = (requestedAt: string) => {
    const now = new Date();
    const requested = new Date(requestedAt);
    const hoursWaiting = Math.floor((now.getTime() - requested.getTime()) / (1000 * 60 * 60));
    const minutesWaiting = Math.floor(((now.getTime() - requested.getTime()) % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hoursWaiting > 0) {
      return `${hoursWaiting}h ${minutesWaiting}m`;
    }
    return `${minutesWaiting}m`;
  };
  
  return (
    <div className="container mx-auto py-6 space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Damage Assessment</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Review and approve appointments with reported vehicle damage
          </p>
        </div>
        
        <Badge variant={pendingAssessments.length > 0 ? "destructive" : "outline"} className="mt-4 md:mt-0">
          {pendingAssessments.length} Pending Review{pendingAssessments.length !== 1 ? 's' : ''}
        </Badge>
      </header>
      
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading pending assessments...</p>
        </div>
      ) : pendingAssessments.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">All Caught Up!</h3>
              <p className="text-gray-500">
                No damage assessments pending review. All appointments are approved or handled.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {pendingAssessments.map((assessment) => (
            <Card key={assessment.appointment.id} className="border-l-4 border-l-orange-500">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-orange-500" />
                      {assessment.service.name} - {assessment.customer.name}
                    </CardTitle>
                    <CardDescription>
                      Scheduled: {format(new Date(assessment.appointment.scheduledTime), 'PPP p')}
                    </CardDescription>
                  </div>
                  
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Waiting: {getTimeWaiting(assessment.appointment.assessmentRequestedAt)}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Customer Info */}
                <div className="grid md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Customer</p>
                    <p className="font-semibold">{assessment.customer.name}</p>
                    <p className="text-sm text-gray-600">{assessment.customer.phone}</p>
                    {assessment.customer.email && (
                      <p className="text-sm text-gray-600">{assessment.customer.email}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Service Location</p>
                    <p className="text-sm">{assessment.appointment.address}</p>
                    <p className="text-sm font-medium text-gray-500 mt-2">Price Range</p>
                    <p className="text-sm">{assessment.service.priceRange}</p>
                  </div>
                </div>
                
                {/* Damage Description */}
                <div>
                  <h4 className="font-semibold mb-2">Reported Issue:</h4>
                  <p className="text-gray-700 dark:text-gray-300 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border-l-4 border-yellow-500">
                    {assessment.appointment.damageDescription || 'No description provided'}
                  </p>
                </div>
                
                {/* Damage Photos */}
                {assessment.appointment.damagePhotos && assessment.appointment.damagePhotos.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Uploaded Photos ({assessment.appointment.damagePhotos.length}):</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {assessment.appointment.damagePhotos.map((photoUrl, index) => (
                        <div key={index} className="relative group">
                          <img 
                            src={photoUrl} 
                            alt={`Damage photo ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-700"
                          />
                          <a
                            href={photoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg"
                            data-testid={`link-photo-${index + 1}`}
                          >
                            <ExternalLink className="h-6 w-6 text-white" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    onClick={() => handleApprove(assessment.appointment.id)}
                    disabled={updateStatusMutation.isPending}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    data-testid={`button-approve-${assessment.appointment.id}`}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve & Confirm
                  </Button>
                  <Button
                    onClick={() => handleReject(assessment.appointment.id)}
                    disabled={updateStatusMutation.isPending}
                    variant="destructive"
                    className="flex-1"
                    data-testid={`button-reject-${assessment.appointment.id}`}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject Appointment
                  </Button>
                </div>
                
                <p className="text-xs text-gray-500 text-center pt-2">
                  💡 Appointments auto-approve after 2 hours if no action taken
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
