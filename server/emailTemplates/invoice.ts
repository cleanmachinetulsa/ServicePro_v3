export interface InvoiceEmailData {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceDate: string;
  vehicleInfo?: string;
  items: Array<{ service: string; quantity: number; price: number }>;
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  loyaltyPoints: { earned: number; newBalance: number };
  paymentLink: string; // HMAC-signed secure link
  venmoUsername: string;
  cashappUsername: string;
  paypalUsername: string;
  upsell?: { title: string; description: string; ctaText: string; ctaUrl: string };
  notes?: string;
}

const BRAND_COLORS = {
  primary: '#1e40af', // Clean Machine blue
  primaryLight: '#3b82f6',
  secondary: '#8b5cf6',
  background: '#f5f6f8',
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  green: '#10b981',
  success: '#059669',
  accent: '#9333ea'
};

/**
 * Generate a beautiful, branded HTML invoice email that exceeds appointment email quality.
 * Features:
 * - Full mobile responsiveness
 * - Clean Machine hexagonal shield branding
 * - Professional invoice table with totals
 * - Loyalty points showcase
 * - Multiple payment options (Stripe, Venmo, CashApp, PayPal)
 * - Smart upsell recommendations
 * - Semantic HTML for accessibility
 * - Email client compatibility (Gmail, Outlook, Apple Mail)
 */
export function renderInvoiceEmail(data: InvoiceEmailData): string {
  const currency = (n: number) => `$${n.toFixed(2)}`;
  const currentYear = new Date().getFullYear();

  // Preheader text (shows in inbox preview)
  const preheader = `Invoice ${data.invoiceNumber} | Total: ${currency(data.total)} | ${data.loyaltyPoints.earned} points earned`;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="format-detection" content="telephone=no"/>
  <meta name="format-detection" content="date=no"/>
  <meta name="format-detection" content="address=no"/>
  <meta name="format-detection" content="email=no"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <title>Invoice ${data.invoiceNumber} - Clean Machine Auto Detail</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    .btn { display: inline-block; padding: 16px 32px; font-size: 16px; font-weight: 700; text-decoration: none; border-radius: 8px; text-align: center; }
    .btn-primary { background-color: ${BRAND_COLORS.primary}; color: ${BRAND_COLORS.white}; }
    .btn-secondary { background-color: ${BRAND_COLORS.accent}; color: ${BRAND_COLORS.white}; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .content { padding: 16px !important; }
      .header-logo { width: 60px !important; height: 60px !important; }
      .btn { width: 100% !important; display: block !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background}; color: ${BRAND_COLORS.gray800};">
  <!-- Preheader Text (hidden, for inbox preview) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${preheader}</div>

  <!-- Main Container -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${BRAND_COLORS.background};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Email Content Card -->
        <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: ${BRAND_COLORS.white}; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header with Branding -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.primaryLight} 100%); padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <div style="background-color: ${BRAND_COLORS.white}; width: 80px; height: 80px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
                      <div style="width: 60px; height: 60px; background-color: ${BRAND_COLORS.primary}; -webkit-clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%); clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%);"></div>
                    </div>
                    <h1 style="margin: 0 0 8px 0; color: ${BRAND_COLORS.white}; font-size: 28px; font-weight: 700; line-height: 1.2;">CLEAN MACHINE</h1>
                    <p style="margin: 0; color: rgba(255, 255, 255, 0.9); font-size: 16px; font-weight: 500;">Auto Detail</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Invoice Header -->
          <tr>
            <td class="content" style="padding: 32px 24px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <h2 style="margin: 0 0 8px 0; color: ${BRAND_COLORS.gray800}; font-size: 24px; font-weight: 700;">Invoice ${data.invoiceNumber}</h2>
                    <p style="margin: 0; color: ${BRAND_COLORS.gray600}; font-size: 14px;">Service Date: ${data.serviceDate}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Customer Information -->
          <tr>
            <td class="content" style="padding: 0 24px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${BRAND_COLORS.gray50}; border: 1px solid ${BRAND_COLORS.gray200}; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 4px 0; color: ${BRAND_COLORS.gray600}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Bill To</p>
                    <p style="margin: 0 0 8px 0; color: ${BRAND_COLORS.gray800}; font-size: 16px; font-weight: 700;">${data.customerName}</p>
                    <p style="margin: 0; color: ${BRAND_COLORS.gray600}; font-size: 14px; line-height: 1.6;">
                      ${data.customerPhone}<br/>
                      ${data.vehicleInfo ? `${data.vehicleInfo}` : ''}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Invoice Items Table -->
          <tr>
            <td class="content" style="padding: 0 24px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid ${BRAND_COLORS.gray200}; border-radius: 8px; overflow: hidden;">
                <!-- Table Header -->
                <tr style="background: linear-gradient(135deg, ${BRAND_COLORS.gray100} 0%, ${BRAND_COLORS.gray50} 100%);">
                  <th align="left" style="padding: 14px 16px; font-size: 13px; font-weight: 700; color: ${BRAND_COLORS.gray700}; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid ${BRAND_COLORS.gray300};">Service</th>
                  <th align="center" style="padding: 14px 16px; font-size: 13px; font-weight: 700; color: ${BRAND_COLORS.gray700}; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid ${BRAND_COLORS.gray300}; width: 60px;">Qty</th>
                  <th align="right" style="padding: 14px 16px; font-size: 13px; font-weight: 700; color: ${BRAND_COLORS.gray700}; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid ${BRAND_COLORS.gray300}; width: 100px;">Price</th>
                </tr>
                <!-- Invoice Items -->
                ${data.items.map((item, index) => `
                <tr style="background-color: ${index % 2 === 0 ? BRAND_COLORS.white : BRAND_COLORS.gray50};">
                  <td style="padding: 14px 16px; font-size: 15px; color: ${BRAND_COLORS.gray800}; border-bottom: 1px solid ${BRAND_COLORS.gray200};">${item.service}</td>
                  <td align="center" style="padding: 14px 16px; font-size: 15px; color: ${BRAND_COLORS.gray700}; border-bottom: 1px solid ${BRAND_COLORS.gray200};">${item.quantity}</td>
                  <td align="right" style="padding: 14px 16px; font-size: 15px; font-weight: 600; color: ${BRAND_COLORS.gray800}; border-bottom: 1px solid ${BRAND_COLORS.gray200};">${currency(item.price * item.quantity)}</td>
                </tr>
                `).join('')}
                <!-- Subtotal -->
                <tr>
                  <td colspan="2" align="right" style="padding: 12px 16px; font-size: 15px; color: ${BRAND_COLORS.gray700}; border-bottom: 1px solid ${BRAND_COLORS.gray200};">Subtotal:</td>
                  <td align="right" style="padding: 12px 16px; font-size: 15px; font-weight: 600; color: ${BRAND_COLORS.gray800}; border-bottom: 1px solid ${BRAND_COLORS.gray200};">${currency(data.subtotal)}</td>
                </tr>
                <!-- Tax -->
                <tr>
                  <td colspan="2" align="right" style="padding: 12px 16px; font-size: 15px; color: ${BRAND_COLORS.gray700}; border-bottom: 1px solid ${BRAND_COLORS.gray200};">Tax (${(data.taxRate * 100).toFixed(1)}%):</td>
                  <td align="right" style="padding: 12px 16px; font-size: 15px; font-weight: 600; color: ${BRAND_COLORS.gray800}; border-bottom: 1px solid ${BRAND_COLORS.gray200};">${currency(data.tax)}</td>
                </tr>
                <!-- Total -->
                <tr style="background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.primaryLight} 100%);">
                  <td colspan="2" align="right" style="padding: 16px; font-size: 18px; font-weight: 700; color: ${BRAND_COLORS.white};">TOTAL:</td>
                  <td align="right" style="padding: 16px; font-size: 22px; font-weight: 700; color: ${BRAND_COLORS.white};">${currency(data.total)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Loyalty Points Showcase -->
          <tr>
            <td class="content" style="padding: 0 24px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #fbbf24; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <p style="margin: 0 0 8px 0; font-size: 24px;">🎉</p>
                    <p style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #78350f;">You Earned ${data.loyaltyPoints.earned} Points!</p>
                    <p style="margin: 0; font-size: 14px; color: #92400e;">New Balance: <strong>${data.loyaltyPoints.newBalance} points</strong></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Payment Options -->
          <tr>
            <td class="content" style="padding: 0 24px 24px;">
              <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: ${BRAND_COLORS.gray800};">Payment Options</h3>
              
              <!-- Primary CTA: Stripe -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 16px;">
                <tr>
                  <td align="center">
                    <a href="${data.paymentLink}" class="btn btn-primary" style="background-color: ${BRAND_COLORS.primary}; color: ${BRAND_COLORS.white}; text-decoration: none; display: inline-block; padding: 16px 32px; font-size: 16px; font-weight: 700; border-radius: 8px; box-shadow: 0 4px 12px rgba(30, 64, 175, 0.3);">
                      💳 Pay with Card (Secure)
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Alternative Payment Methods -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${BRAND_COLORS.gray50}; border: 1px solid ${BRAND_COLORS.gray200}; border-radius: 8px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: ${BRAND_COLORS.gray700}; font-weight: 600;">Other Ways to Pay:</p>
                    <p style="margin: 0; font-size: 14px; color: ${BRAND_COLORS.gray600}; line-height: 1.8;">
                      <strong>Venmo:</strong> ${data.venmoUsername}<br/>
                      <strong>Cash App:</strong> ${data.cashappUsername}<br/>
                      <strong>PayPal:</strong> ${data.paypalUsername}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${data.upsell ? `
          <!-- Smart Upsell Recommendation -->
          <tr>
            <td class="content" style="padding: 0 24px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); border: 2px solid ${BRAND_COLORS.accent}; border-radius: 8px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #581c87;">✨ ${data.upsell.title}</p>
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #7c3aed; line-height: 1.6;">${data.upsell.description}</p>
                    <a href="${data.upsell.ctaUrl}" class="btn btn-secondary" style="background-color: ${BRAND_COLORS.accent}; color: ${BRAND_COLORS.white}; text-decoration: none; display: inline-block; padding: 12px 24px; font-size: 15px; font-weight: 700; border-radius: 6px;">${data.upsell.ctaText}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          ${data.notes ? `
          <!-- Custom Notes -->
          <tr>
            <td class="content" style="padding: 0 24px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${BRAND_COLORS.gray50}; border-left: 4px solid ${BRAND_COLORS.primary}; border-radius: 4px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 700; color: ${BRAND_COLORS.gray600}; text-transform: uppercase; letter-spacing: 0.5px;">Note from Clean Machine</p>
                    <p style="margin: 0; font-size: 14px; color: ${BRAND_COLORS.gray700}; line-height: 1.6;">${data.notes.replace(/\r?\n/g, '<br>')}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: ${BRAND_COLORS.gray50}; border-top: 1px solid ${BRAND_COLORS.gray200}; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 12px 0; font-size: 13px; color: ${BRAND_COLORS.gray600}; text-align: center; line-height: 1.6;">
                Questions about your invoice?<br/>
                Reply to this email or call us at <a href="tel:+19188565304" style="color: ${BRAND_COLORS.primary}; text-decoration: none; font-weight: 600;">918-856-5304</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: ${BRAND_COLORS.gray600}; text-align: center;">
                © ${currentYear} Clean Machine Auto Detail. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generate plain-text version of invoice email for accessibility
 */
export function renderInvoiceEmailPlainText(data: InvoiceEmailData): string {
  const currency = (n: number) => `$${n.toFixed(2)}`;
  
  return `CLEAN MACHINE AUTO DETAIL
Invoice ${data.invoiceNumber}

Service Date: ${data.serviceDate}

BILL TO:
${data.customerName}
${data.customerPhone}
${data.vehicleInfo || ''}

SERVICES:
${data.items.map(item => `${item.service} x${item.quantity} ... ${currency(item.price * item.quantity)}`).join('\n')}

Subtotal: ${currency(data.subtotal)}
Tax (${(data.taxRate * 100).toFixed(1)}%): ${currency(data.tax)}
TOTAL: ${currency(data.total)}

🎉 LOYALTY POINTS
You earned ${data.loyaltyPoints.earned} points!
New balance: ${data.loyaltyPoints.newBalance} points

PAYMENT OPTIONS:
Pay securely with card: ${data.paymentLink}

Or send payment via:
Venmo: ${data.venmoUsername}
Cash App: ${data.cashappUsername}
PayPal: ${data.paypalUsername}

${data.upsell ? `
RECOMMENDED FOR YOU:
${data.upsell.title}
${data.upsell.description}
Learn more: ${data.upsell.ctaUrl}
` : ''}

${data.notes ? `
NOTE FROM CLEAN MACHINE:
${data.notes}
` : ''}

Questions? Reply to this email or call 918-856-5304

© ${new Date().getFullYear()} Clean Machine Auto Detail`;
}
