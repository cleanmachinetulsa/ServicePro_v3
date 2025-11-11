import { Express, Request, Response } from 'express';
import { searchAllCustomerData, getEnhancedCustomerServiceHistory } from './enhancedCustomerSearch';

/**
 * Register enhanced customer search routes that pull data from all customer-related sheets
 */
export function registerEnhancedCustomerRoutes(app: Express) {
  // Enhanced customer search endpoint
  app.get('/api/enhanced/customers/search', async (req: Request, res: Response) => {
    try {
      const { query, field = 'all' } = req.query;
      
      if (!query) {
        return res.json({ 
          success: true, 
          message: 'No search query provided. Use the search parameter to find customers.',
          results: [] 
        });
      }
      
      console.log(`Performing enhanced customer search for "${query}" in field "${field}"`);
      
      const results = await searchAllCustomerData(query.toString(), field.toString());
      
      return res.json({ 
        success: true, 
        count: results.length,
        results 
      });
    } catch (error) {
      console.error('Error in enhanced customer search:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to search customer database across all sheets' 
      });
    }
  });
  
  // Enhanced customer details endpoint
  app.get('/api/enhanced/customers/:phone', async (req: Request, res: Response) => {
    try {
      console.log(`Retrieving enhanced customer details for phone: ${req.params.phone}`);
      
      const customerInfo = await getEnhancedCustomerServiceHistory(req.params.phone);
      
      if (!customerInfo.found) {
        return res.json({
          success: false,
          customer: null,
          message: `No customer records found for phone number ${req.params.phone}`
        });
      }
      
      return res.json({
        success: true,
        customer: customerInfo
      });
    } catch (error) {
      console.error('Error retrieving enhanced customer details:', error);
      return res.json({
        success: false,
        customer: null,
        error: 'Failed to retrieve customer information'
      });
    }
  });
  
  // Get all customers with consolidated information
  app.get('/api/enhanced/customers', async (req: Request, res: Response) => {
    try {
      console.log('Retrieving all customers from all sheets');
      
      const limit = req.query.limit ? parseInt(req.query.limit.toString()) : undefined;
      const allCustomers = await searchAllCustomerData('', 'all');
      
      const results = limit ? allCustomers.slice(0, limit) : allCustomers;
      
      return res.json({ 
        success: true, 
        count: results.length,
        customers: results 
      });
    } catch (error) {
      console.error('Error retrieving all customers:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to retrieve all customers across sheets' 
      });
    }
  });
}