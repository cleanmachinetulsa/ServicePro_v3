/**
 * Base Branded Email Template System
 * Reusable layout components for all customer emails
 * Matches invoice quality with Clean Machine branding
 */

// ========================================
// TYPE DEFINITIONS
// ========================================

export interface EmailSection {
  type: 'text' | 'highlight' | 'table' | 'list' | 'spacer';
  content?: string;
  items?: Array<{ label: string; value: string }>;
  backgroundColor?: string;
  padding?: string;
}

export interface EmailCTA {
  text: string;
  url: string;
  style?: 'primary' | 'secondary' | 'link';
}

export interface EmailData {
  preheader: string;
  subject: string;
  hero: {
    title: string;
    subtitle?: string;
  };
  sections: EmailSection[];
  ctas?: EmailCTA[];
  notes?: string;
}

// ========================================
// BRAND COLORS & CONSTANTS
// ========================================

const COLORS = {
  primary: '#7c3aed',      // Purple
  primaryDark: '#6d28d9',
  secondary: '#f59e0b',    // Amber/Gold
  text: '#1f2937',
  textLight: '#6b7280',
  background: '#ffffff',
  backgroundGray: '#f9fafb',
  border: '#e5e7eb',
  success: '#10b981',
  white: '#ffffff',
};

const LOGO_HEXAGON = `
  <div style="background-color: ${COLORS.white}; width: 80px; height: 80px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
    <div style="width: 60px; height: 60px; background-color: ${COLORS.primary}; -webkit-clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%); clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%);"></div>
  </div>
`;

// ========================================
// COMPONENT RENDERERS
// ========================================

function renderHeader(title: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); padding: 32px 24px; border-radius: 12px 12px 0 0;">
      <tr>
        <td align="center">
          ${LOGO_HEXAGON}
          <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0; font-family: Arial, sans-serif; line-height: 1.2;">
            CLEAN MACHINE
          </h1>
          <p style="color: rgba(255, 255, 255, 0.9); font-size: 16px; font-weight: 500; margin: 0; font-family: Arial, sans-serif;">
            ${title}
          </p>
        </td>
      </tr>
    </table>
  `;
}

function renderSection(section: EmailSection): string {
  const bgColor = section.backgroundColor || 'transparent';
  const padding = section.padding || '20px';

  switch (section.type) {
    case 'text':
      return `
        <div style="background-color: ${bgColor}; padding: ${padding}; font-family: Arial, sans-serif; line-height: 1.6; color: ${COLORS.text};">
          ${section.content || ''}
        </div>
      `;

    case 'highlight':
      return `
        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-left: 4px solid ${COLORS.success}; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <p style="margin: 0; font-family: Arial, sans-serif; color: ${COLORS.text}; font-size: 15px; line-height: 1.6;">
            ${section.content || ''}
          </p>
        </div>
      `;

    case 'table':
      if (!section.items || section.items.length === 0) return '';
      
      const rows = section.items.map((item, index) => {
        const bgColor = index % 2 === 0 ? '#f9fafb' : '#ffffff';
        return `
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid ${COLORS.border}; background-color: ${bgColor}; font-family: Arial, sans-serif; color: ${COLORS.text};">
              ${item.label}
            </td>
            <td style="padding: 12px 16px; border-bottom: 1px solid ${COLORS.border}; background-color: ${bgColor}; font-family: Arial, sans-serif; color: ${COLORS.text}; font-weight: bold; text-align: right;">
              ${item.value}
            </td>
          </tr>
        `;
      }).join('');

      return `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; border: 1px solid ${COLORS.border}; border-radius: 8px; overflow: hidden;">
          ${rows}
        </table>
      `;

    case 'list':
      if (!section.items || section.items.length === 0) return '';
      
      const listItems = section.items.map(item => `
        <li style="margin-bottom: 8px; font-family: Arial, sans-serif; color: ${COLORS.text};">
          <strong>${item.label}:</strong> ${item.value}
        </li>
      `).join('');

      return `
        <ul style="padding-left: 20px; margin: 15px 0;">
          ${listItems}
        </ul>
      `;

    case 'spacer':
      return `<div style="height: ${padding};"></div>`;

    default:
      return '';
  }
}

function renderCTA(cta: EmailCTA): string {
  let buttonStyle = '';
  
  if (cta.style === 'primary' || !cta.style) {
    buttonStyle = `
      background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%);
      color: ${COLORS.white};
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 8px;
      display: inline-block;
      font-weight: bold;
      font-size: 16px;
      font-family: Arial, sans-serif;
      box-shadow: 0 4px 6px rgba(124, 58, 237, 0.2);
    `;
  } else if (cta.style === 'secondary') {
    buttonStyle = `
      background-color: ${COLORS.white};
      color: ${COLORS.primary};
      border: 2px solid ${COLORS.primary};
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 8px;
      display: inline-block;
      font-weight: bold;
      font-size: 16px;
      font-family: Arial, sans-serif;
    `;
  } else {
    buttonStyle = `
      color: ${COLORS.primary};
      text-decoration: underline;
      font-weight: 600;
      font-size: 15px;
      font-family: Arial, sans-serif;
    `;
  }

  return `
    <a href="${cta.url}" style="${buttonStyle}">${cta.text}</a>
  `;
}

function renderFooter(): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${COLORS.backgroundGray}; padding: 30px 20px; margin-top: 40px;">
      <tr>
        <td align="center">
          <p style="font-family: Arial, sans-serif; color: ${COLORS.textLight}; font-size: 14px; margin: 0 0 15px 0;">
            Follow us for tips, promotions, and updates!
          </p>
          <div style="margin: 15px 0;">
            <a href="https://www.facebook.com/cleanmachinetulsa" style="text-decoration: none; margin: 0 10px;">
              <span style="display: inline-block; width: 32px; height: 32px; background-color: ${COLORS.primary}; color: white; border-radius: 50%; text-align: center; line-height: 32px; font-weight: bold;">f</span>
            </a>
            <a href="https://www.instagram.com/cleanmachinetulsa" style="text-decoration: none; margin: 0 10px;">
              <span style="display: inline-block; width: 32px; height: 32px; background-color: ${COLORS.primary}; color: white; border-radius: 50%; text-align: center; line-height: 32px; font-weight: bold;">i</span>
            </a>
          </div>
          <p style="font-family: Arial, sans-serif; color: ${COLORS.textLight}; font-size: 13px; margin: 15px 0 5px 0;">
            Clean Machine Auto Detail<br>
            Tulsa, Oklahoma<br>
            📞 (918) 856-5304<br>
            📧 info@cleanmachinetulsa.com
          </p>
          <p style="font-family: Arial, sans-serif; color: ${COLORS.textLight}; font-size: 12px; margin: 15px 0 0 0;">
            © ${new Date().getFullYear()} Clean Machine Auto Detail. All rights reserved.
          </p>
        </td>
      </tr>
    </table>
  `;
}

// ========================================
// MAIN TEMPLATE RENDERER
// ========================================

export function renderBrandedEmail(data: EmailData): string {
  const sections = data.sections.map(renderSection).join('\n');
  const ctas = data.ctas ? `
    <div style="text-align: center; margin: 30px 0;">
      ${data.ctas.map(renderCTA).join(' ')}
    </div>
  ` : '';

  const notes = data.notes ? `
    <div style="background-color: ${COLORS.backgroundGray}; padding: 20px; margin-top: 30px; border-radius: 8px; border-left: 4px solid ${COLORS.secondary};">
      <p style="margin: 0; font-family: Arial, sans-serif; color: ${COLORS.textLight}; font-size: 14px; line-height: 1.6;">
        <strong>Note:</strong> ${data.notes}
      </p>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>${data.subject}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
  <style>
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        padding: 0 !important;
      }
      .mobile-padding {
        padding: 15px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, sans-serif;">
  <span style="display: none !important; visibility: hidden; mso-hide: all; font-size: 1px; color: #f3f4f6; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden;">
    ${data.preheader}
  </span>
  
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6; padding: 20px 0;">
    <tr>
      <td align="center">
        <table class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; max-width: 600px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border-radius: 12px; overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td>
              ${renderHeader(data.hero.subtitle || data.subject)}
            </td>
          </tr>
          
          <!-- Hero Section -->
          <tr>
            <td class="mobile-padding" style="padding: 40px 30px 20px 30px;">
              <h2 style="font-family: Arial, sans-serif; color: ${COLORS.text}; font-size: 24px; font-weight: bold; margin: 0 0 10px 0;">
                ${data.hero.title}
              </h2>
              ${data.hero.subtitle ? `
                <p style="font-family: Arial, sans-serif; color: ${COLORS.textLight}; font-size: 16px; margin: 0;">
                  ${data.hero.subtitle}
                </p>
              ` : ''}
            </td>
          </tr>
          
          <!-- Content Sections -->
          <tr>
            <td class="mobile-padding" style="padding: 0 30px 20px 30px;">
              ${sections}
            </td>
          </tr>
          
          <!-- CTAs -->
          ${ctas ? `
          <tr>
            <td class="mobile-padding" style="padding: 0 30px 30px 30px;">
              ${ctas}
            </td>
          </tr>
          ` : ''}
          
          <!-- Notes -->
          ${notes ? `
          <tr>
            <td class="mobile-padding" style="padding: 0 30px 30px 30px;">
              ${notes}
            </td>
          </tr>
          ` : ''}
          
          <!-- Footer -->
          <tr>
            <td>
              ${renderFooter()}
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ========================================
// PLAIN TEXT RENDERER
// ========================================

export function renderBrandedEmailPlainText(data: EmailData): string {
  let text = `${data.hero.title}\n`;
  
  if (data.hero.subtitle) {
    text += `${data.hero.subtitle}\n`;
  }
  
  text += `\n${'='.repeat(60)}\n\n`;
  
  // Render sections as plain text
  data.sections.forEach(section => {
    if (section.type === 'text' || section.type === 'highlight') {
      text += `${section.content}\n\n`;
    } else if (section.type === 'table' || section.type === 'list') {
      section.items?.forEach(item => {
        text += `${item.label}: ${item.value}\n`;
      });
      text += '\n';
    } else if (section.type === 'spacer') {
      text += '\n';
    }
  });
  
  // Render CTAs
  if (data.ctas && data.ctas.length > 0) {
    text += `${'='.repeat(60)}\n\n`;
    data.ctas.forEach(cta => {
      text += `${cta.text}: ${cta.url}\n`;
    });
    text += '\n';
  }
  
  // Render notes
  if (data.notes) {
    text += `NOTE: ${data.notes}\n\n`;
  }
  
  // Footer
  text += `${'='.repeat(60)}\n\n`;
  text += `Clean Machine Auto Detail\n`;
  text += `Tulsa, Oklahoma\n`;
  text += `Phone: (918) 856-5304\n`;
  text += `Email: info@cleanmachinetulsa.com\n`;
  text += `Facebook: https://www.facebook.com/cleanmachinetulsa\n`;
  text += `Instagram: https://www.instagram.com/cleanmachinetulsa\n\n`;
  text += `© ${new Date().getFullYear()} Clean Machine Auto Detail. All rights reserved.\n`;
  
  return text.trim();
}
