import { Express, Request, Response } from 'express';

export function registerCancellationRoutes(app: Express) {
  // Cancellation feedback endpoint
  app.post('/api/cancellation-feedback', async (req: Request, res: Response) => {
    try {
      const { appointmentDetails, feedback } = req.body;
      
      // Log the cancellation feedback for business insights
      console.log('=== APPOINTMENT CANCELLATION FEEDBACK ===');
      console.log('Date:', new Date().toISOString());
      console.log('Customer:', appointmentDetails.customerName);
      console.log('Service:', appointmentDetails.service);
      console.log('Scheduled Date:', appointmentDetails.date);
      console.log('Scheduled Time:', appointmentDetails.time);
      console.log('Reason Category:', feedback.category);
      console.log('Specific Reason:', feedback.reason);
      console.log('Would Reschedule:', feedback.wouldReschedule ? 'Yes' : 'No');
      console.log('Additional Comments:', feedback.additionalComments || 'None provided');
      console.log('==========================================');
      
      res.json({
        success: true,
        message: 'Cancellation feedback received successfully'
      });
    } catch (error) {
      console.error('Error processing cancellation feedback:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process cancellation feedback'
      });
    }
  });
}