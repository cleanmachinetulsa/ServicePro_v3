import { Express, Request, Response } from 'express';
import { z } from 'zod';
import {
  createUpsellOffer,
  updateUpsellOffer,
  getAllUpsellOffers,
  getActiveUpsellOffers,
  getUpsellOfferById,
  deleteUpsellOffer,
  createAppointmentUpsell,
  getApplicableUpsellsForAppointment,
  updateAppointmentUpsell,
  getActiveAppointmentUpsells,
  getAppointmentUpsellsWithDetails,
  applyUpsellOffer
} from './upsellService';
import { demoProtectionMiddleware } from './demoProtection';

export function registerUpsellRoutes(app: Express) {
  // =========== Upsell Offers Management ===========

  // Get all upsell offers
  app.get('/api/upsell/offers', async (req: Request, res: Response) => {
    try {
      const activeOnly = req.query.active === 'true';
      const offers = activeOnly ? await getActiveUpsellOffers() : await getAllUpsellOffers();
      res.json({ success: true, offers });
    } catch (error) {
      console.error('Error fetching upsell offers:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch upsell offers' });
    }
  });

  // Get a single upsell offer by ID
  app.get('/api/upsell/offers/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, error: 'Invalid ID format' });
      }
      
      const offer = await getUpsellOfferById(id);
      if (!offer) {
        return res.status(404).json({ success: false, error: 'Upsell offer not found' });
      }
      
      res.json({ success: true, offer });
    } catch (error) {
      console.error('Error fetching upsell offer:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch upsell offer' });
    }
  });

  // Create a new upsell offer
  app.post('/api/upsell/offers', demoProtectionMiddleware, async (req: Request, res: Response) => {
    try {
      // Define validation schema
      const schema = z.object({
        name: z.string().min(1, 'Name is required'),
        description: z.string().min(1, 'Description is required'),
        serviceId: z.number().optional(),
        addOnService: z.boolean().optional(),
        discountPercentage: z.number().min(0).max(100).optional(),
        discountAmount: z.number().min(0).optional(),
        active: z.boolean().optional(),
        displayOrder: z.number().optional(),
        minimumPurchaseAmount: z.number().min(0).optional(),
        applicableServiceIds: z.array(z.string()).optional(),
        validityDays: z.number().min(1).optional(),
      });

      // Validate input
      const validatedData = schema.parse(req.body);
      
      // Create the offer
      const offer = await createUpsellOffer(validatedData);
      res.status(201).json({ success: true, offer });
    } catch (error) {
      console.error('Error creating upsell offer:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: error.errors });
      }
      res.status(500).json({ success: false, error: 'Failed to create upsell offer' });
    }
  });

  // Update an existing upsell offer
  app.put('/api/upsell/offers/:id', demoProtectionMiddleware, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, error: 'Invalid ID format' });
      }
      
      // Define validation schema
      const schema = z.object({
        name: z.string().min(1, 'Name is required').optional(),
        description: z.string().min(1, 'Description is required').optional(),
        serviceId: z.number().optional(),
        addOnService: z.boolean().optional(),
        discountPercentage: z.number().min(0).max(100).optional(),
        discountAmount: z.number().min(0).optional(),
        active: z.boolean().optional(),
        displayOrder: z.number().optional(),
        minimumPurchaseAmount: z.number().min(0).optional(),
        applicableServiceIds: z.array(z.string()).optional(),
        validityDays: z.number().min(1).optional(),
      });

      // Validate input
      const validatedData = schema.parse(req.body);
      
      // Update the offer
      const offer = await updateUpsellOffer(id, validatedData);
      if (!offer) {
        return res.status(404).json({ success: false, error: 'Upsell offer not found' });
      }
      
      res.json({ success: true, offer });
    } catch (error) {
      console.error('Error updating upsell offer:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: error.errors });
      }
      res.status(500).json({ success: false, error: 'Failed to update upsell offer' });
    }
  });

  // Delete an upsell offer
  app.delete('/api/upsell/offers/:id', demoProtectionMiddleware, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, error: 'Invalid ID format' });
      }
      
      const success = await deleteUpsellOffer(id);
      if (!success) {
        return res.status(404).json({ success: false, error: 'Upsell offer not found' });
      }
      
      res.json({ success: true, message: 'Upsell offer deleted successfully' });
    } catch (error) {
      console.error('Error deleting upsell offer:', error);
      res.status(500).json({ success: false, error: 'Failed to delete upsell offer' });
    }
  });

  // =========== Appointment Upsells Management ===========

  // Get all upsell offers applicable for an appointment
  app.get('/api/upsell/appointment/:appointmentId/applicable', async (req: Request, res: Response) => {
    try {
      const appointmentId = parseInt(req.params.appointmentId);
      if (isNaN(appointmentId)) {
        return res.status(400).json({ success: false, error: 'Invalid appointment ID format' });
      }
      
      const offers = await getApplicableUpsellsForAppointment(appointmentId);
      res.json({ success: true, offers });
    } catch (error) {
      console.error('Error fetching applicable upsell offers:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch applicable upsell offers' });
    }
  });

  // Create a new appointment upsell
  app.post('/api/upsell/appointment/:appointmentId', demoProtectionMiddleware, async (req: Request, res: Response) => {
    try {
      const appointmentId = parseInt(req.params.appointmentId);
      if (isNaN(appointmentId)) {
        return res.status(400).json({ success: false, error: 'Invalid appointment ID format' });
      }
      
      // Define validation schema
      const schema = z.object({
        upsellOfferId: z.number()
      });

      // Validate input
      const validatedData = schema.parse(req.body);
      
      // Create the appointment upsell
      const appointmentUpsell = await createAppointmentUpsell(
        appointmentId, 
        validatedData.upsellOfferId
      );
      
      res.status(201).json({ success: true, appointmentUpsell });
    } catch (error) {
      console.error('Error creating appointment upsell:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: error.errors });
      }
      res.status(500).json({ success: false, error: 'Failed to create appointment upsell' });
    }
  });

  // Get active upsells for an appointment
  app.get('/api/upsell/appointment/:appointmentId/active', async (req: Request, res: Response) => {
    try {
      const appointmentId = parseInt(req.params.appointmentId);
      if (isNaN(appointmentId)) {
        return res.status(400).json({ success: false, error: 'Invalid appointment ID format' });
      }
      
      const upsells = await getActiveAppointmentUpsells(appointmentId);
      res.json({ success: true, upsells });
    } catch (error) {
      console.error('Error fetching active appointment upsells:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch active appointment upsells' });
    }
  });

  // Get all upsells with details for an appointment
  app.get('/api/upsell/appointment/:appointmentId/details', async (req: Request, res: Response) => {
    try {
      const appointmentId = parseInt(req.params.appointmentId);
      if (isNaN(appointmentId)) {
        return res.status(400).json({ success: false, error: 'Invalid appointment ID format' });
      }
      
      const upsellsWithDetails = await getAppointmentUpsellsWithDetails(appointmentId);
      res.json({ success: true, upsells: upsellsWithDetails });
    } catch (error) {
      console.error('Error fetching appointment upsells with details:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch appointment upsells with details' });
    }
  });

  // Accept or decline an appointment upsell
  app.put('/api/upsell/appointment-upsells/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, error: 'Invalid ID format' });
      }
      
      // Define validation schema
      const schema = z.object({
        status: z.enum(['accepted', 'declined', 'expired']),
        newAppointmentId: z.number().optional(),
        customerInfo: z.any().optional()
      });

      // Validate input
      const validatedData = schema.parse(req.body);
      
      // If accepting the upsell, handle the appointment creation logic
      if (validatedData.status === 'accepted' && !validatedData.newAppointmentId) {
        // Apply the upsell offer (create appointment with discount)
        const result = await applyUpsellOffer(id, validatedData.customerInfo);
        
        if (result.success && result.appointmentId) {
          // Update the appointment upsell with the new appointment ID
          const appointmentUpsell = await updateAppointmentUpsell(id, 'accepted', result.appointmentId);
          
          return res.json({ 
            success: true, 
            appointmentUpsell, 
            message: result.message,
            newAppointmentId: result.appointmentId
          });
        } else {
          return res.status(400).json({ 
            success: false, 
            error: result.message || 'Failed to apply upsell offer' 
          });
        }
      } else {
        // Just update the status without creating a new appointment
        const appointmentUpsell = await updateAppointmentUpsell(
          id, 
          validatedData.status, 
          validatedData.newAppointmentId
        );
        
        if (!appointmentUpsell) {
          return res.status(404).json({ success: false, error: 'Appointment upsell not found' });
        }
        
        res.json({ success: true, appointmentUpsell });
      }
    } catch (error) {
      console.error('Error updating appointment upsell:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: error.errors });
      }
      res.status(500).json({ success: false, error: 'Failed to update appointment upsell' });
    }
  });
}