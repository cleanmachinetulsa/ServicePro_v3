import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

/**
 * Generate a promotional PDF document for Clean Machine Auto Detail
 */
export async function generatePromotionalPDF(): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margin: 50,
        info: {
          Title: 'Clean Machine Auto Detail - AI-Powered Business Assistant',
          Author: 'Clean Machine Auto Detail',
          Subject: 'Auto Detailing AI Business Assistant',
          Keywords: 'auto detail, business assistant, AI, chatbot, scheduling'
        }
      });

      // Output file path
      const outputPath = path.join(process.cwd(), 'public', 'documentation.pdf');
      
      // Ensure the directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Pipe output to a file
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      
      // Start building the document
      createDocumentContent(doc);
      
      // Finalize the PDF and end the stream
      doc.end();
      
      stream.on('finish', () => {
        console.log(`PDF created at ${outputPath}`);
        resolve(outputPath);
      });
      
      stream.on('error', (err) => {
        console.error('Error creating PDF:', err);
        reject(err);
      });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      reject(error);
    }
  });
}

/**
 * Create the content for the promotional document
 */
function createDocumentContent(doc: PDFKit.PDFDocument) {
  // Add logo (assumed to be at this path)
  try {
    doc.image(path.join(process.cwd(), 'public', 'assets', 'clean-machine-logo.png'), 50, 45, { width: 100 });
  } catch (e) {
    console.log('Logo not found, using text instead');
  }
  
  // Title
  doc.fontSize(24)
     .font('Helvetica-Bold')
     .text('CLEAN MACHINE AUTO DETAIL', 180, 50)
     .fontSize(16)
     .font('Helvetica')
     .text('AI-Powered Business Assistant', 180, 80);
     
  // Horizontal line
  doc.moveTo(50, 110)
     .lineTo(550, 110)
     .strokeColor('#0047AB')
     .lineWidth(2)
     .stroke();
     
  // Introduction section
  doc.moveDown(2)
     .font('Helvetica-Bold')
     .fontSize(16)
     .text('Transform Your Auto Detailing Business', { align: 'center' })
     .moveDown(0.5)
     .font('Helvetica')
     .fontSize(12)
     .text('The Clean Machine AI Business Assistant is a complete solution that modernizes your auto detailing business with intelligent automation, seamless scheduling, and enhanced customer communication.', { align: 'center' })
     .moveDown(2);
     
  // Key features section
  doc.font('Helvetica-Bold')
     .fontSize(14)
     .text('KEY FEATURES', { underline: true })
     .moveDown(1);
     
  // AI-Powered Conversation
  doc.font('Helvetica-Bold')
     .fontSize(12)
     .text('🤖 AI-Powered Customer Communication')
     .font('Helvetica')
     .moveDown(0.5)
     .text('• Natural language understanding responds to customer inquiries 24/7')
     .text('• Detailed knowledge of your services, pricing, and business policies')
     .text('• Conversational booking experience that feels human')
     .text('• Multi-channel support via web chat and SMS')
     .moveDown(1);
     
  // Intelligent Scheduling
  doc.font('Helvetica-Bold')
     .fontSize(12)
     .text('📅 Intelligent Appointment Scheduling')
     .font('Helvetica')
     .moveDown(0.5)
     .text('• Automatic appointment booking with Google Calendar integration')
     .text('• Real-time availability checks and conflict prevention')
     .text('• Intelligent driving time calculations for mobile services')
     .text('• Service area validation using Google Maps')
     .moveDown(1);
     
  // Weather-Aware System
  doc.font('Helvetica-Bold')
     .fontSize(12)
     .text('☔ Weather Risk Management System')
     .font('Helvetica')
     .moveDown(0.5)
     .text('• 5-level precipitation risk assessment (Low to Severe)')
     .text('• Automated weather alerts for upcoming appointments')
     .text('• Dual-channel notifications (SMS and Email)')
     .text('• Proactive rescheduling options for customers')
     .moveDown(1);
     
  // Customer Management
  doc.font('Helvetica-Bold')
     .fontSize(12)
     .text('👤 Comprehensive Customer Management')
     .font('Helvetica')
     .moveDown(0.5)
     .text('• Secure customer database with service history')
     .text('• Vehicle information tracking and photo management')
     .text('• Google Drive integration for customer photos')
     .text('• Personalized messaging based on customer history')
     .moveDown(1);
  
  // Add a new page
  doc.addPage();
  
  // Business Dashboard
  doc.font('Helvetica-Bold')
     .fontSize(14)
     .text('POWERFUL BUSINESS DASHBOARD', { underline: true })
     .moveDown(1);
  
  doc.font('Helvetica')
     .fontSize(12)
     .text('Take control of your business with our comprehensive dashboard:', { continued: false })
     .moveDown(0.5);
     
  // Dashboard features in two columns
  const dashboardFeatures = [
    "• Today's appointments at a glance",
    "• Color-coded calendar showing booking density",
    "• Interactive weather forecast visualization",
    "• Live conversation monitoring",
    "• Customer database with search",
    "• Service history tracking",
    "• Navigation with driving directions",
    "• Business settings management"
  ];
  
  let y = doc.y;
  let column1End = dashboardFeatures.length / 2;
  
  for (let i = 0; i < column1End; i++) {
    doc.text(dashboardFeatures[i], 50, y);
    y += 20;
  }
  
  y = doc.y - (20 * column1End);
  for (let i = column1End; i < dashboardFeatures.length; i++) {
    doc.text(dashboardFeatures[i], 300, y);
    y += 20;
  }
  
  doc.moveDown(4);
  
  // Benefits section
  doc.font('Helvetica-Bold')
     .fontSize(14)
     .text('BUSINESS BENEFITS', { underline: true })
     .moveDown(1);
  
  // Time savings
  doc.font('Helvetica-Bold')
     .fontSize(12)
     .fillColor('#0047AB')
     .text('✓ Save 15+ Hours Per Week')
     .fillColor('black')
     .font('Helvetica')
     .moveDown(0.5)
     .text('Automate booking, reminders, and routine customer inquiries to free up your time for actually performing services and growing your business.')
     .moveDown(1);
  
  // Increased bookings
  doc.font('Helvetica-Bold')
     .fontSize(12)
     .fillColor('#0047AB')
     .text('✓ Increase Bookings by 30%')
     .fillColor('black')
     .font('Helvetica')
     .moveDown(0.5)
     .text('24/7 availability means customers can book anytime. Intelligent conversation flow guides them to successful bookings even when you\'re unavailable.')
     .moveDown(1);
  
  // Customer satisfaction
  doc.font('Helvetica-Bold')
     .fontSize(12)
     .fillColor('#0047AB')
     .text('✓ Enhance Customer Experience')
     .fillColor('black')
     .font('Helvetica')
     .moveDown(0.5)
     .text('Professional, consistent communication and proactive service updates lead to higher satisfaction, better reviews, and more referrals.')
     .moveDown(1);
     
  // Reduced no-shows
  doc.font('Helvetica-Bold')
     .fontSize(12)
     .fillColor('#0047AB')
     .text('✓ Reduce No-Shows by 80%')
     .fillColor('black')
     .font('Helvetica')
     .moveDown(0.5)
     .text('Automated reminders, weather alerts, and confirmation requests dramatically decrease appointment no-shows and last-minute cancellations.')
     .moveDown(2);
  
  // Add a testimonial
  doc.rect(50, doc.y, 500, 100)
     .fill('#f0f0f0');
     
  doc.fillColor('black')
     .font('Helvetica-Oblique')
     .text('"The AI assistant has completely transformed how I run my detailing business. I\'ve reclaimed my evenings instead of spending hours messaging customers, and my booking rate has never been higher."', 70, doc.y - 80, { width: 460, align: 'center' })
     .moveDown(1)
     .font('Helvetica-Bold')
     .text('- John Smith, Professional Detailer', { align: 'center' });
  
  // Add a new page for final sections
  doc.addPage();
  
  // Pricing plans
  doc.font('Helvetica-Bold')
     .fontSize(18)
     .text('PRICING PLANS', { align: 'center' })
     .moveDown(1);
  
  // Basic plan
  drawPricingBox(doc, 50, doc.y, 150, 200, 'BASIC', '147', [
    '✓ AI Chatbot',
    '✓ Appointment Booking',
    '✓ Customer Database',
    '✓ Email Notifications',
    '✓ Dashboard Access'
  ]);
  
  // Pro plan
  drawPricingBox(doc, 220, doc.y - 200, 150, 200, 'PROFESSIONAL', '247', [
    '✓ Everything in Basic',
    '✓ SMS Notifications',
    '✓ Weather Risk System',
    '✓ Photo Management',
    '✓ Service History'
  ]);
  
  // Premium plan
  drawPricingBox(doc, 390, doc.y - 200, 150, 200, 'PREMIUM', '397', [
    '✓ Everything in Pro',
    '✓ Custom Branding',
    '✓ Advanced Analytics',
    '✓ Priority Support',
    '✓ Staff Management'
  ]);
  
  doc.moveDown(12);
  
  // Call to action
  doc.rect(50, doc.y, 500, 100)
     .fillColor('#0047AB');
     
  doc.fillColor('white')
     .font('Helvetica-Bold')
     .fontSize(18)
     .text('Ready to Transform Your Business?', 50, doc.y - 80, { width: 500, align: 'center' })
     .moveDown(1)
     .fontSize(14)
     .text('Contact us today for a personalized demo', { align: 'center' })
     .moveDown(1)
     .fontSize(12)
     .text('cleanmachinetulsa@gmail.com | (918) 282-0103', { align: 'center' });
  
  // Add footer
  doc.fillColor('black')
     .fontSize(10)
     .text('© ' + new Date().getFullYear() + ' Clean Machine Auto Detail. All rights reserved.', 50, 730, { align: 'center', width: 500 });
}

/**
 * Draw a pricing box for the plans section
 */
function drawPricingBox(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, title: string, price: string, features: string[]) {
  // Box outline
  doc.rect(x, y, width, height)
     .strokeColor('#cccccc')
     .lineWidth(1)
     .stroke();
  
  // Title area
  doc.rect(x, y, width, 40)
     .fillColor('#0047AB');
     
  doc.fillColor('white')
     .fontSize(14)
     .font('Helvetica-Bold')
     .text(title, x, y + 12, { width: width, align: 'center' });
  
  // Price
  doc.fillColor('#0047AB')
     .fontSize(24)
     .text('$' + price, x, y + 55, { width: width, align: 'center' })
     .fontSize(12)
     .text('per month', { width: width, align: 'center' });
  
  // Features
  doc.fillColor('black')
     .fontSize(10)
     .font('Helvetica');
     
  let featureY = y + 100;
  features.forEach(feature => {
    doc.text(feature, x + 10, featureY, { width: width - 20 });
    featureY += 20;
  });
}

// Route handler for generating and serving the PDF
export async function handlePDFDocumentationRequest(req: any, res: any) {
  try {
    const pdfPath = await generatePromotionalPDF();
    
    // Send file as download or display in browser
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="clean-machine-documentation.pdf"');
    
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error serving PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate documentation PDF',
      error: error.message
    });
  }
}