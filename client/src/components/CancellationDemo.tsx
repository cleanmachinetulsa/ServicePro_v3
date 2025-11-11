import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CancellationFeedbackModal from './CancellationFeedbackModal';

export default function CancellationDemo() {
  const [showModal, setShowModal] = useState(false);

  const sampleAppointment = {
    service: 'Full Detail',
    date: 'May 26, 2025',
    time: '2:00 PM',
    customerName: 'John Smith'
  };

  const handleCancellation = (feedback: any) => {
    console.log('Cancellation feedback received:', feedback);
    setShowModal(false);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Cancellation Feedback Demo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">Sample Appointment:</h4>
          <p><strong>Service:</strong> {sampleAppointment.service}</p>
          <p><strong>Date:</strong> {sampleAppointment.date}</p>
          <p><strong>Time:</strong> {sampleAppointment.time}</p>
          <p><strong>Customer:</strong> {sampleAppointment.customerName}</p>
        </div>
        
        <Button 
          onClick={() => setShowModal(true)}
          variant="destructive"
          className="w-full"
        >
          Cancel Appointment (Demo)
        </Button>

        <CancellationFeedbackModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onConfirmCancellation={handleCancellation}
          appointmentDetails={sampleAppointment}
        />
      </CardContent>
    </Card>
  );
}