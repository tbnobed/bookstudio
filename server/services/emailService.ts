import { MailService } from '@sendgrid/mail';
import type { User, Booking, Studio, NotificationGroup } from '@shared/schema';
import { format } from 'date-fns';

// Initialize the mail service
const mailService = new MailService();

// Check if SendGrid API key is available
if (!process.env.SENDGRID_API_KEY) {
  console.warn('SENDGRID_API_KEY environment variable is not set. Email functionality is disabled.');
} else {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('SendGrid email service initialized');
}

// Email template for booking notifications
interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

// Format date for emails in facility timezone
export function formatDate(date: Date): string {
  const facilityTimezone = process.env.VITE_FACILITY_TIMEZONE || 'America/Chicago';
  const facilityDate = new Date(date).toLocaleString('en-US', {
    timeZone: facilityTimezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  // Add timezone abbreviation for clarity
  const timezoneName = facilityTimezone.split('/')[1].replace('_', ' ');
  return `${facilityDate} (${timezoneName})`;
}

// SendGrid email sender
export async function sendEmail(params: EmailParams): Promise<boolean> {
  console.log('[EmailService] === EMAIL SEND ATTEMPT ===');
  console.log('[EmailService] SendGrid API Key present:', !!process.env.SENDGRID_API_KEY);
  console.log('[EmailService] From address:', params.from);
  console.log('[EmailService] To address:', params.to);
  console.log('[EmailService] Subject:', params.subject);
  
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.error('[EmailService] CRITICAL: SendGrid API key not set. Email not sent.');
      return false;
    }

    // Debug email parameters before sending
    console.log('[EmailService] Preparing email data...');
    console.log('[EmailService] Has HTML:', !!params.html);
    console.log('[EmailService] Has text:', !!params.text);
    console.log('[EmailService] HTML length:', params.html?.length || 0);
    console.log('[EmailService] Text length:', params.text?.length || 0);

    // Ensure we have at least one content type for SendGrid
    const emailData: any = {
      to: params.to,
      from: params.from,
      subject: params.subject,
    };

    // Add HTML content if available
    if (params.html) {
      emailData.html = params.html;
    }

    // Add text content if available, or generate simple fallback from HTML
    if (params.text) {
      emailData.text = params.text;
    } else if (params.html) {
      // Generate simple text fallback from HTML for SendGrid compatibility
      emailData.text = params.html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    } else {
      emailData.text = 'Email content not available in text format.';
    }

    console.log('[EmailService] Calling SendGrid API...');
    await mailService.send(emailData);
    
    console.log(`[EmailService] ✓ Email sent successfully to ${params.to}`);
    return true;
  } catch (error: any) {
    console.error('[EmailService] ✗ SendGrid email error:', error.message);
    console.error('[EmailService] Error code:', error.code);
    console.error('[EmailService] Full error object:', error);
    if (error?.response?.body?.errors) {
      console.error('[EmailService] SendGrid error details:', JSON.stringify(error.response.body.errors, null, 2));
    }
    return false;
  }
}

// Email templates
const FROM_EMAIL = process.env.SENDGRID_VERIFIED_SENDER || 'noreply@bookstud.io';
const SITE_MANAGER_EMAIL = process.env.SITE_MANAGER_EMAIL || 'obedtest@tbn.tv';
const APP_NAME = 'BookStud.io';

// Function to get the application URL dynamically
function getApplicationUrl(): string {
  // Prioritize custom production domain first - clean domain without ports
  if (process.env.APP_DOMAIN) {
    return process.env.APP_DOMAIN;
  }
  
  // Check for Replit domains (development/staging)
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(',').map(d => d.trim());
    return `https://${domains[0]}`;
  }
  
  // Check for Replit dev domain
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  
  // Fallback for local development only
  const port = process.env.PORT || 5000;
  return `http://localhost:${port}`;
}

// Modern HTML email template base optimized for email clients
function createEmailTemplate(content: string, title: string): string {
  const logoUrl = `${getApplicationUrl()}/assets/logo.png`;
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc;">
        <tr>
            <td align="center" style="padding: 20px;">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px;">
                    ${content}
                    <tr>
                        <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="color: #6b7280; font-size: 14px; margin: 0;">This email was sent by ${APP_NAME} &copy; ${new Date().getFullYear()} The Plex Studios</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

// Helper function to format studios list
function formatStudios(studioNames: string[]): string {
  if (!studioNames || studioNames.length === 0) return 'No studios assigned';
  return studioNames.map(name => `<span style="display: inline-block; background-color: #ddd6fe; color: #5b21b6; padding: 4px 12px; border-radius: 6px; font-size: 14px; font-weight: 500; margin: 2px 4px 2px 0;">${name}</span>`).join('');
}

// Format changes for display in email
function formatChanges(changes: any, studios: Studio[]): Array<{label: string, value: string}> {
  const formattedChanges: Array<{label: string, value: string}> = [];
  
  for (const [key, value] of Object.entries(changes)) {
    let label = key;
    let formattedValue = String(value);
    
    // Format specific fields to match the main booking display
    switch (key) {
      case 'title':
        label = 'Title';
        break;
      case 'description':
        label = 'Description';
        break;
      case 'type':
        label = 'Type';
        break;
      case 'status':
        label = 'Status';
        formattedValue = String(value).toUpperCase();
        break;
      case 'start':
        label = 'Start';
        formattedValue = formatDate(new Date(String(value)));
        break;
      case 'end':
        label = 'End';
        formattedValue = formatDate(new Date(String(value)));
        break;
      case 'studioIds':
        label = 'Studios';
        if (Array.isArray(value)) {
          const studioNames = value.map(id => {
            const studio = studios.find(s => s.id === id);
            return studio ? studio.name : `Studio ${id}`;
          });
          formattedValue = studioNames.join(', ') || 'No studios assigned';
        }
        break;
      case 'pcrRoomId':
        label = 'PCR Room';
        if (value === null || value === undefined) {
          formattedValue = 'None';
        } else {
          formattedValue = `PCR ${value}`;
        }
        break;
      case 'color':
        label = 'Color';
        if (value) {
          formattedValue = String(value);
        }
        break;
      case 'notifyList':
        label = 'Notification Groups';
        if (Array.isArray(value)) {
          formattedValue = value.length > 0 ? `${value.length} groups` : 'None';
        }
        break;
      case 'severity':
        label = 'Severity';
        if (value) {
          formattedValue = String(value).toLowerCase();
        }
        break;
      // Skip internal fields that users don't need to see
      case 'userId':
      case 'studioId':
      case 'templateId':
        continue;
      default:
        // Capitalize first letter for unknown fields
        label = key.charAt(0).toUpperCase() + key.slice(1);
        break;
    }
    
    formattedChanges.push({ label, value: formattedValue });
  }
  
  return formattedChanges;
}

// Import the notification group service to get site management group
import { getSiteManagementGroup, getAllSiteManagementGroups } from './notificationGroupService';

// Send site manager notification for any booking activity
async function notifySiteManagers(
  booking: Booking,
  studio: Studio,
  action: 'created' | 'updated' | 'cancelled',
  user: User
): Promise<boolean> {
  try {
    // Get the site management notification group
    const siteManagementGroup = await getSiteManagementGroup();
    
    if (!siteManagementGroup) {
      console.warn('Site management group not found. Cannot send notification to site managers.');
      return false;
    }
    
    const actionText = action.charAt(0).toUpperCase() + action.slice(1);
    const subject = `${APP_NAME} - Studio Booking ${actionText} (SITE MANAGER NOTIFICATION)`;
    
    const actionColors = {
      created: '#10b981',
      updated: '#f59e0b', 
      cancelled: '#ef4444'
    };
    
    // Create stylized HTML content for site managers (no severity for regular bookings)
    const appUrl = getApplicationUrl();
    const bookingUrl = `${appUrl}/?booking=${booking.id}`;
    
    const htmlContent = `
                    <tr>
                        <td style="background: #2563eb; padding: 40px 24px; text-align: center;">
                            <div style="width: 100px; height: 100px; margin: 0 auto 24px auto; background-color: #ffffff; border-radius: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(0,0,0,0.3);">
                                <img src="${logoUrl}" alt="BookStud.io Logo" style="height: 128px; width: auto;" />
                            </div>
                            <a href="${bookingUrl}" style="display: inline-block; background-color: #ffffff; color: #1f2937; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">View Booking Details</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 32px 24px;">
                            <div style="display: inline-block; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 0 0 24px 0; text-align: center; background-color: ${actionColors[action]}; color: white;">
                                BOOKING ${actionText.toUpperCase()}
                            </div>
                            
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;"><strong>Site Manager Alert:</strong> A studio booking has been ${action} and requires your attention.</p>
                            
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 24px 0;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <h3 style="font-size: 20px; font-weight: 600; color: #1f2937; margin: 0 0 16px 0;">${booking.title}</h3>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280; width: 80px;">Studio:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${studio.name}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Start:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${formatDate(booking.start)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">End:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${formatDate(booking.end)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Type:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${booking.type}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Status:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${booking.status || 'pending'}</td>
                                            </tr>
                                            ${booking.description ? `
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Description:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${booking.description}</td>
                                            </tr>` : ''}
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">User:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${user.username} (${user.email})</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <div style="text-align: center; margin: 24px 0;">
                                <a href="${bookingUrl}" style="display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">View Full Booking Details</a>
                            </div>
                            
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0;">This automated notification has been sent to all site managers for tracking and coordination purposes.</p>
                        </td>
                    </tr>`;
    
    return sendEmail({
      to: siteManagementGroup.email,
      from: FROM_EMAIL,
      subject,
      html: createEmailTemplate(htmlContent, subject),
    });
  } catch (error) {
    console.error('Error sending site manager notification:', error);
    return false;
  }
}

// Send booking confirmation
export async function sendBookingConfirmation(
  booking: Booking, 
  studio: Studio, 
  user: User
): Promise<boolean> {
  const subject = `${APP_NAME} - Studio Booking Confirmation`;
  const appUrl = getApplicationUrl();
  const bookingUrl = `${appUrl}/?booking=${booking.id}`;
  
  const htmlContent = `
                    <tr>
                        <td style="padding: 32px 24px; text-align: center;">
                            <img src="${logoUrl}" alt="BookStud.io Logo" style="height: 128px; width: auto; margin-bottom: 24px;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 24px 32px 24px;">
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;">Hello <strong>${user.username}</strong>,</p>
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;">Your studio booking has been confirmed and is ready for production.</p>
                            
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 24px 0;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <h3 style="font-size: 20px; font-weight: 600; color: #1f2937; margin: 0 0 16px 0;">${booking.title}</h3>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280; width: 80px;">Studio:</td>
                                                <td style="padding: 6px 0; color: #1f2937;"><span style="display: inline-block; background-color: #ddd6fe; color: #5b21b6; padding: 4px 12px; border-radius: 6px; font-size: 14px; font-weight: 500;">${studio.name}</span></td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Start:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${formatDate(booking.start)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">End:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${formatDate(booking.end)}</td>
                                            </tr>
                                            ${booking.description ? `
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Description:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${booking.description}</td>
                                            </tr>` : ''}
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Status:</td>
                                                <td style="padding: 6px 0; color: #1f2937;"><span style="display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; background-color: #dcfce7; color: #166534;">CONFIRMED</span></td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <div style="text-align: center; margin: 24px 0;">
                                <a href="${bookingUrl}" style="display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">View Full Booking Details</a>
                            </div>
                            
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;">You can view and manage all your bookings by logging into your ${APP_NAME} account.</p>
                            
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0;">If you need to make any changes or have questions about your booking, please contact the studio management team.</p>
                        </td>
                    </tr>`;

  const text = `
    Hello ${user.name},
    
    Your studio booking has been confirmed:
    
    - Studio: ${studio.name}
    - Title: ${booking.title}
    - From: ${formatDate(booking.start)}
    - To: ${formatDate(booking.end)}
    ${booking.description ? `- Description: ${booking.description}` : ''}
    
    You can view and manage your bookings at any time by logging into BookStud.io.
    
    Thank you for using BookStud.io!
  `;
  
  // First send the user notification
  const userNotification = await sendEmail({
    to: user.email,
    from: FROM_EMAIL,
    subject,
    text,
    html: createEmailTemplate(htmlContent, subject),
  });
  
  // Then notify site managers
  const siteManagerNotification = await notifySiteManagers(booking, studio, 'created', user);
  
  return userNotification; // Return result of user notification
}

// Send booking update notification
export async function sendBookingUpdate(
  booking: Booking, 
  studio: Studio, 
  user: User
): Promise<boolean> {
  const subject = `${APP_NAME} - Studio Booking Updated`;
  const appUrl = getApplicationUrl();
  const bookingUrl = `${appUrl}/?booking=${booking.id}`;
  
  const htmlContent = `
                    <tr>
                        <td style="padding: 32px 24px; text-align: center;">
                            <img src="${logoUrl}" alt="BookStud.io Logo" style="height: 128px; width: auto; margin-bottom: 24px;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 24px 32px 24px;">
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;">Hello <strong>${user.username}</strong>,</p>
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;">Your studio booking has been updated with new details.</p>
                            
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 24px 0;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <h3 style="font-size: 20px; font-weight: 600; color: #1f2937; margin: 0 0 16px 0;">${booking.title}</h3>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280; width: 80px;">Studio:</td>
                                                <td style="padding: 6px 0; color: #1f2937;"><span style="display: inline-block; background-color: #ddd6fe; color: #5b21b6; padding: 4px 12px; border-radius: 6px; font-size: 14px; font-weight: 500;">${studio.name}</span></td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Start:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${formatDate(booking.start)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">End:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${formatDate(booking.end)}</td>
                                            </tr>
                                            ${booking.description ? `
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Description:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${booking.description}</td>
                                            </tr>` : ''}
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Status:</td>
                                                <td style="padding: 6px 0; color: #1f2937;"><span style="display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; background-color: #fef3c7; color: #d97706;">UPDATED</span></td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <div style="text-align: center; margin: 24px 0;">
                                <a href="${bookingUrl}" style="display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">View Full Booking Details</a>
                            </div>
                            
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;">Please review the updated information and ensure it meets your production requirements.</p>
                            
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0;">You can view and manage all your bookings by logging into your ${APP_NAME} account.</p>
                        </td>
                    </tr>`;

  const text = `
    Hello ${user.name},
    
    Your studio booking has been updated:
    
    - Studio: ${studio.name}
    - Title: ${booking.title}
    - From: ${formatDate(booking.start)}
    - To: ${formatDate(booking.end)}
    ${booking.description ? `- Description: ${booking.description}` : ''}
    
    You can view and manage your bookings at any time by logging into BookStud.io.
    
    Thank you for using BookStud.io!
  `;
  
  // First send the user notification
  const userNotification = await sendEmail({
    to: user.email,
    from: FROM_EMAIL,
    subject,
    text,
    html: createEmailTemplate(htmlContent, subject),
  });
  
  // Then notify site managers
  const siteManagerNotification = await notifySiteManagers(booking, studio, 'updated', user);
  
  return userNotification; // Return result of user notification
}

// Send booking cancellation notification
export async function sendBookingCancellation(
  booking: Booking, 
  studio: Studio, 
  user: User
): Promise<boolean> {
  console.log('[EmailService] === BOOKING CANCELLATION EMAIL START ===');
  console.log('[EmailService] Booking ID:', booking.id);
  console.log('[EmailService] User email:', user.email);
  console.log('[EmailService] Studio name:', studio.name);
  
  const subject = `${APP_NAME} - Studio Booking Cancelled`;
  const appUrl = getApplicationUrl();
  const bookingUrl = `${appUrl}/?booking=${booking.id}`;
  
  const htmlContent = `
                    <tr>
                        <td style="padding: 32px 24px; text-align: center;">
                            <img src="${logoUrl}" alt="BookStud.io Logo" style="height: 128px; width: auto; margin-bottom: 24px;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 24px 32px 24px;">
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;">Hello <strong>${user.username}</strong>,</p>
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;">We're writing to inform you that your studio booking has been cancelled.</p>
                            
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 24px 0;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <h3 style="font-size: 20px; font-weight: 600; color: #1f2937; margin: 0 0 16px 0;">${booking.title}</h3>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280; width: 80px;">Studio:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${studio.name}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Start:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${formatDate(booking.start)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">End:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${formatDate(booking.end)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Status:</td>
                                                <td style="padding: 6px 0; color: #1f2937;"><span style="display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; background-color: #fee2e2; color: #991b1b;">CANCELLED</span></td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <div style="text-align: center; margin: 24px 0;">
                                <a href="${bookingUrl}" style="display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; border: 2px solid #1d4ed8;">View Full Booking Details</a>
                            </div>
                            
                            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 24px 0;">
                                <p style="font-size: 16px; font-weight: 600; color: #92400e; margin: 0 0 8px 0;">Important Notice</p>
                                <p style="font-size: 16px; line-height: 1.7; color: #92400e; margin: 0;">If you did not request this cancellation, please contact the studio management team immediately.</p>
                            </div>
                            
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0;">You can view all your bookings and create new ones by logging into your ${APP_NAME} account.</p>
                        </td>
                    </tr>`;

  const text = `
    Hello ${user.name},
    
    Your studio booking has been cancelled:
    
    - Studio: ${studio.name}
    - Title: ${booking.title}
    - From: ${formatDate(booking.start)}
    - To: ${formatDate(booking.end)}
    
    If you did not request this cancellation, please contact support immediately.
    
    Thank you for using BookStud.io!
  `;
  
  // First send the user notification
  const userNotification = await sendEmail({
    to: user.email,
    from: FROM_EMAIL,
    subject,
    text,
    html: createEmailTemplate(htmlContent, subject),
  });
  
  // Then notify site managers
  const siteManagerNotification = await notifySiteManagers(booking, studio, 'cancelled', user);
  
  return userNotification; // Return result of user notification
}

// Send maintenance alert notification
export async function sendMaintenanceAlert(
  booking: Booking, 
  users: User[]
): Promise<boolean[]> {
  const subject = `${APP_NAME} - Maintenance Alert`;
  const appUrl = getApplicationUrl();
  const bookingUrl = `${appUrl}/?booking=${booking.id}`;
  
  const htmlContent = `
    <div class="header">
        <h1>${APP_NAME}</h1>
        <p>Maintenance Alert</p>
        <a href="${bookingUrl}" class="header-link">View Maintenance Details</a>
    </div>
    <div class="content">
        ${createSeverityBadge(booking.severity || 'Medium')}
        
        <p class="message-text"><strong>Scheduled Maintenance Notice</strong></p>
        <p class="message-text">A maintenance event has been scheduled that may affect studio availability.</p>
        
        <div class="booking-card">
            <div class="booking-title">${booking.title}</div>
            <div class="booking-details">
                <div class="detail-row">
                    <span class="detail-label">Type:</span>
                    <span class="detail-value">Maintenance</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Start:</span>
                    <span class="detail-value">${formatDate(booking.start)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">End:</span>
                    <span class="detail-value">${formatDate(booking.end)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Severity:</span>
                    <span class="detail-value">${booking.severity || 'Medium'}</span>
                </div>
                ${booking.description ? `
                <div class="detail-row">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value">${booking.description}</span>
                </div>` : ''}
            </div>
        </div>
        
        <a href="${bookingUrl}" class="cta-button">View Full Maintenance Details</a>
        
        <p class="message-text">Please plan your production schedules accordingly and contact the facilities team if you have any questions.</p>
    </div>
  `;

  const text = `
    MAINTENANCE ALERT
    
    A maintenance event has been scheduled:
    
    - Title: ${booking.title}
    - Type: Maintenance
    - Severity: ${booking.severity || 'Medium'}
    - From: ${formatDate(booking.start)}
    - To: ${formatDate(booking.end)}
    ${booking.description ? `- Description: ${booking.description}` : ''}
    
    This may affect studio availability. Please plan accordingly.
    
    Thank you for using BookStud.io!
  `;
  
  // Get the site management group
  const siteManagementGroup = await getSiteManagementGroup();
  
  // Send emails to all affected users
  const userPromises = users.map(user => 
    sendEmail({
      to: user.email,
      from: FROM_EMAIL,
      subject,
      text,
      html: createEmailTemplate(htmlContent, subject),
    })
  );
  
  // Always ensure site managers are notified of maintenance alerts
  if (siteManagementGroup) {
    console.log(`Sending maintenance alert to site management group: ${siteManagementGroup.name}`);
    
    // Send a more detailed message to site managers
    const siteManagerHtmlContent = `
                    <tr>
                        <td style="background: #2563eb; padding: 40px 24px; text-align: center;">
                            <div style="width: 100px; height: 100px; margin: 0 auto 24px auto; background-color: #ffffff; border-radius: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(0,0,0,0.3);">
                                <img src="${logoUrl}" alt="BookStud.io Logo" style="height: 128px; width: auto;" />
                            </div>
                            <a href="${bookingUrl}" style="display: inline-block; background: #ffffff; color: #dc2626 !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">View Maintenance Details</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 32px 24px;">
                            <div style="display: inline-block; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 0 0 24px 0; text-align: center; background-color: ${severityColor}; color: white;">
                                ${(booking.severity || 'Medium').toUpperCase()} PRIORITY
                            </div>
                            
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;"><strong>Site Manager Alert</strong></p>
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;">A maintenance event has been scheduled that requires your attention.</p>
                            
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 24px 0;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <h3 style="font-size: 20px; font-weight: 600; color: #1f2937; margin: 0 0 16px 0;">${booking.title}</h3>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280; width: 80px;">Type:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">Maintenance</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Start:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${formatDate(booking.start)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">End:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${formatDate(booking.end)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Severity:</td>
                                                <td style="padding: 6px 0; color: #1f2937;"><span style="display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 14px; font-weight: 500; background-color: ${severityColor}; color: white;">${booking.severity || 'Medium'}</span></td>
                                            </tr>
                                            ${booking.description ? `
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Description:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${booking.description}</td>
                                            </tr>` : ''}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <div style="text-align: center; margin: 24px 0;">
                                <a href="${bookingUrl}" style="display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">View Full Maintenance Details</a>
                            </div>
                            
                            <div style="display: inline-block; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 0 0 24px 0; text-align: center; background-color: #dc2626; color: white;">
                                Management Action Required
                            </div>
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;">As a site manager, please ensure all affected teams are notified and coordinate with facilities management.</p>
                            
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0;">This is an automated notification sent to all site managers.</p>
                        </td>
                    </tr>`;

    const siteManagerText = `
      MAINTENANCE ALERT - SITE MANAGER NOTIFICATION
      
      A maintenance event has been scheduled:
      
      - Title: ${booking.title}
      - Type: Maintenance
      - Severity: ${booking.severity || 'Medium'}
      - From: ${formatDate(booking.start)}
      - To: ${formatDate(booking.end)}
      ${booking.description ? `- Description: ${booking.description}` : ''}
      
      This may affect studio availability. Please plan accordingly.
      
      This is an automated notification sent to all site managers.
      
      Thank you,
      BookStud.io
    `;
    
    // Add site manager notification to the promise array
    userPromises.push(
      sendEmail({
        to: siteManagementGroup.email,
        from: FROM_EMAIL,
        subject: `${subject} (SITE MANAGER NOTIFICATION)`,
        text: siteManagerText,
        html: createEmailTemplate(siteManagerHtmlContent, `${subject} (SITE MANAGER NOTIFICATION)`),
      })
    );
  }
  
  return Promise.all(userPromises);
}

// Send facility-wide alert notification
export async function sendFacilityAlert(
  booking: Booking, 
  users: User[]
): Promise<boolean[]> {
  const subject = `${APP_NAME} - IMPORTANT: Facility-Wide Alert`;
  const appUrl = getApplicationUrl();
  const bookingUrl = `${appUrl}/?booking=${booking.id}`;
  
  const alertSeverityColor = severityColors[booking.severity?.toLowerCase() as keyof typeof severityColors] || '#dc2626';
  
  const htmlContent = `
                    <tr>
                        <td style="padding: 32px 24px; text-align: center;">
                            <img src="${logoUrl}" alt="BookStud.io Logo" style="height: 128px; width: auto; margin-bottom: 24px;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 24px 32px 24px;">
                            <div style="display: inline-block; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 0 0 24px 0; text-align: center; background-color: ${alertSeverityColor}; color: white;">
                                ${(booking.severity || 'High').toUpperCase()} PRIORITY
                            </div>
                            
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;"><strong>FACILITY-WIDE ALERT</strong></p>
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;">An important facility-wide alert has been issued that affects all studios and facilities.</p>
                            
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 24px 0;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <h3 style="font-size: 20px; font-weight: 600; color: #1f2937; margin: 0 0 16px 0;">${booking.title}</h3>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280; width: 80px;">Type:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${booking.type}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Start:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${formatDate(booking.start)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">End:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${formatDate(booking.end)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Severity:</td>
                                                <td style="padding: 6px 0; color: #1f2937;"><span style="display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 14px; font-weight: 500; background-color: ${alertSeverityColor}; color: white;">${booking.severity || 'High'}</span></td>
                                            </tr>
                                            ${booking.description ? `
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Description:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${booking.description}</td>
                                            </tr>` : ''}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <div style="text-align: center; margin: 24px 0;">
                                <a href="${bookingUrl}" style="display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">View Full Alert Details</a>
                            </div>
                            
                            <div style="display: inline-block; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 0 0 24px 0; text-align: center; background-color: #dc2626; color: white;">
                                URGENT: All Facilities Affected
                            </div>
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;">This alert affects all studio operations. Please review your production schedules and coordinate with the facilities management team immediately.</p>
                            
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0;">Contact the facilities management team if you have any questions or concerns about this alert.</p>
                        </td>
                    </tr>`;

  const text = `
    FACILITY-WIDE ALERT
    
    An important facility-wide alert has been issued:
    
    - Title: ${booking.title}
    - Type: ${booking.type}
    - Severity: ${booking.severity || 'High'}
    - From: ${formatDate(booking.start)}
    - To: ${formatDate(booking.end)}
    ${booking.description ? `- Description: ${booking.description}` : ''}
    
    This affects all studios and facilities. Please plan accordingly.
    
    Thank you for using BookStud.io!
  `;
  
  // Get the site management group
  const siteManagementGroup = await getSiteManagementGroup();
  
  // Send emails to all users
  const userPromises = users.map(user => 
    sendEmail({
      to: user.email,
      from: FROM_EMAIL,
      subject,
      text,
      html: createEmailTemplate(htmlContent, subject),
    })
  );
  
  // Always ensure site managers are notified of facility alerts
  if (siteManagementGroup) {
    console.log(`Sending facility alert to site management group: ${siteManagementGroup.name}`);
    
    // Send a more detailed message to site managers
    const siteManagerHtmlContent = `
                    <tr>
                        <td style="padding: 32px 24px; text-align: center;">
                            <img src="${logoUrl}" alt="BookStud.io Logo" style="height: 128px; width: auto; margin-bottom: 24px;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 32px 24px;">
                            <div style="display: inline-block; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 0 0 24px 0; text-align: center; background-color: #dc2626; color: white;">
                                ${(booking.severity || 'High').toUpperCase()} PRIORITY
                            </div>
                            
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;"><strong>CRITICAL FACILITY-WIDE ALERT</strong></p>
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;">An urgent facility-wide alert requires immediate site manager attention and action.</p>
                            
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 24px 0;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <h3 style="font-size: 20px; font-weight: 600; color: #1f2937; margin: 0 0 16px 0;">${booking.title}</h3>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280; width: 80px;">Type:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${booking.type}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Start:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${formatDate(booking.start)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">End:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${formatDate(booking.end)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Severity:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${booking.severity || 'High'}</td>
                                            </tr>
                                            ${booking.description ? `
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Description:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${booking.description}</td>
                                            </tr>` : ''}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <div style="text-align: center; margin: 24px 0;">
                                <a href="${bookingUrl}" style="display: inline-block; background: #dc2626; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">View Full Alert Details</a>
                            </div>
                            
                            <div style="display: inline-block; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 0 0 24px 0; text-align: center; background-color: #dc2626; color: white;">
                                CRITICAL: Site Manager Action Required
                            </div>
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;">As a site manager, you must:</p>
                            <ul style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 24px;">
                                <li>Immediately assess impact on all studio operations</li>
                                <li>Coordinate with all department heads and production teams</li>
                                <li>Implement emergency protocols as necessary</li>
                                <li>Ensure all staff are notified of this facility-wide alert</li>
                            </ul>
                            
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0;">This is an automated notification sent to all site managers.</p>
                        </td>
                    </tr>
    `;

    const siteManagerText = `
      FACILITY-WIDE ALERT - SITE MANAGER NOTIFICATION
      
      An important facility-wide alert has been issued:
      
      - Title: ${booking.title}
      - Type: ${booking.type}
      - Severity: ${booking.severity || 'High'}
      - From: ${formatDate(booking.start)}
      - To: ${formatDate(booking.end)}
      ${booking.description ? `- Description: ${booking.description}` : ''}
      
      This affects all studios and facilities. Please plan accordingly.
      
      This is an automated notification sent to all site managers.
      
      Thank you,
      BookStud.io
    `;
    
    // Add site manager notification to the promise array
    userPromises.push(
      sendEmail({
        to: siteManagementGroup.email,
        from: FROM_EMAIL,
        subject: `${subject} (SITE MANAGER NOTIFICATION)`,
        text: siteManagerText,
        html: createEmailTemplate(siteManagerHtmlContent, `${subject} (SITE MANAGER NOTIFICATION)`),
      })
    );
  }
  
  return Promise.all(userPromises);
}
/**
 * Send comprehensive site manager notification for all booking activities
 * This ensures the site manager receives notification for every booking operation
 */
export async function sendSiteManagerNotification(
  booking: Booking,
  studios: Studio[],
  user: User,
  action: 'created' | 'updated' | 'cancelled' | 'deleted',
  changes?: any
): Promise<boolean> {
  console.log(`Sending site manager notification for booking ${booking.id} (${action})`);
  console.log('Changes object received:', changes);
  console.log('Studios for formatting:', studios);
  
  const actionLabels = {
    created: 'New Booking Created',
    updated: 'Booking Updated',
    cancelled: 'Booking Cancelled',
    deleted: 'Booking Deleted'
  };
  
  const actionColors = {
    created: '#10b981',
    updated: '#f59e0b', 
    cancelled: '#ef4444',
    deleted: '#dc2626'
  };
  
  const subject = `${actionLabels[action]}: ${booking.title}`;
  const studioNames = studios.map(s => s.name);
  const appUrl = getApplicationUrl();
  const bookingUrl = `${appUrl}/?booking=${booking.id}`;
  
  console.log(`[EmailService] Site Manager notification - App URL: ${appUrl}`);
  console.log(`[EmailService] Site Manager notification - Booking URL: ${bookingUrl}`);
  
  // Create the logo URL for this function using consistent domain resolution
  const logoUrl = `${appUrl}/assets/logo.png`;
  
  // Create clean HTML content for site manager notification
  const htmlContent = `
                    <tr>
                        <td style="padding: 32px 24px; text-align: center;">
                            <img src="${logoUrl}" alt="BookStud.io Logo" style="height: 128px; width: auto; margin-bottom: 24px;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 24px 32px 24px;">
                            <div style="display: inline-block; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 0 0 24px 0; text-align: center; background-color: ${actionColors[action]}; color: white;">
                                ${actionLabels[action].toUpperCase()}
                            </div>
                            
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;"><strong>Action Required:</strong> Site manager notification for booking activity.</p>
                            
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 24px 0;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <h3 style="font-size: 20px; font-weight: 600; color: #1f2937; margin: 0 0 16px 0;">${booking.title}</h3>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280; width: 80px;">Action:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${actionLabels[action]}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Studios:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${formatStudios(studioNames)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Start:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${formatDate(booking.start)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">End:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${formatDate(booking.end)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Type:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${booking.type}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Status:</td>
                                                <td style="padding: 6px 0; color: #1f2937;"><span style="display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 14px; font-weight: 500; text-transform: uppercase; background-color: #e5e7eb; color: #374151;">${booking.status || 'pending'}</span></td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">User:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${user.username} (${user.email})</td>
                                            </tr>
                                            ${booking.description ? `
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280;">Description:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${booking.description}</td>
                                            </tr>` : ''}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <div style="text-align: center; margin: 24px 0;">
                                <a href="${bookingUrl}" style="display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; border: 2px solid #1d4ed8;">View Full Booking Details</a>
                            </div>
                            
                            ${changes && action === 'updated' ? `
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 24px 0;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <h3 style="font-size: 20px; font-weight: 600; color: #1f2937; margin: 0 0 16px 0;">Changes Made</h3>
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            ${formatChanges(changes, studios).map(change => `
                                            <tr>
                                                <td style="padding: 6px 0; font-weight: 500; color: #6b7280; width: 80px;">${change.label}:</td>
                                                <td style="padding: 6px 0; color: #1f2937;">${change.value}</td>
                                            </tr>`).join('')}
                                        </table>
                                    </td>
                                </tr>
                            </table>` : ''}
                            
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;">
                              <strong>Site Manager Action:</strong> Please review this booking activity and take any necessary actions 
                              to ensure proper facility coordination and resource management.
                            </p>
                            
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0;">This is an automated notification sent to the site manager for all booking activities.</p>
                        </td>
                    </tr>`;

  // Send to ALL site management groups instead of just one
  const siteManagementGroups = await getAllSiteManagementGroups();
  
  if (siteManagementGroups.length === 0) {
    console.error('No site management groups found for notification');
    return false;
  }

  console.log(`[EmailService] Sending site manager notifications to ${siteManagementGroups.length} groups:`, 
    siteManagementGroups.map(g => `${g.name} (${g.email})`));

  // Send email to ALL site management groups
  let allSuccessful = true;
  for (const group of siteManagementGroups) {
    try {
      console.log(`[EmailService] Sending to ${group.name} (${group.email})`);
      const success = await sendEmail({
        to: group.email,
        from: FROM_EMAIL,
        subject: `[SITE MANAGER] ${subject}`,
        html: createEmailTemplate(htmlContent, `[SITE MANAGER] ${subject}`),
      });
      
      if (!success) {
        console.error(`[EmailService] Failed to send to ${group.email}`);
        allSuccessful = false;
      } else {
        console.log(`[EmailService] ✓ Successfully sent to ${group.email}`);
      }
    } catch (error) {
      console.error(`[EmailService] Error sending to ${group.email}:`, error);
      allSuccessful = false;
    }
  }
  
  return allSuccessful;
}
