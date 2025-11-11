/**
 * Client-side utilities for handling invoice-related loyalty points
 */

/**
 * Awards loyalty points after an invoice is sent
 * This function should be called when the "Send Invoice" button is clicked
 * 
 * @param {Object} invoiceDetails - The details of the invoice
 * @returns {Promise<Object>} - Response indicating success or failure
 */
export async function awardLoyaltyPointsAfterInvoice(invoiceDetails: any) {
  if (!invoiceDetails) return null;
  
  try {
    // Calculate the amount from the total
    const amount = invoiceDetails.total || 0;
    
    if (amount <= 0) {
      console.warn('Invoice amount is zero or negative, no loyalty points will be awarded');
      return { success: false, message: 'Invoice amount must be greater than zero' };
    }
    
    // Prepare the request data
    const requestData = {
      customerPhone: invoiceDetails.phone,
      invoiceId: Date.now(), // Using timestamp as a simple invoice ID
      amount: amount,
      customerName: invoiceDetails.customerName
    };
    
    // Make API call to award loyalty points
    const response = await fetch('/api/invoice/award-loyalty-points', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Failed to award loyalty points');
    }
    
    console.log('Successfully awarded loyalty points:', result);
    return result;
  } catch (error: any) {
    console.error('Error awarding loyalty points:', error);
    return {
      success: false,
      message: error.message || 'An error occurred while awarding loyalty points'
    };
  }
}