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

// Format date for emails
export function formatDate(date: Date): string {
  return format(new Date(date), 'EEEE, MMMM d, yyyy - h:mm a');
}

// SendGrid email sender
export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('SendGrid API key not set. Email not sent.');
      return false;
    }

    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text || '',
      html: params.html || params.text || '',
    });
    
    console.log(`Email sent successfully to ${params.to}`);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

// Email templates
const FROM_EMAIL = process.env.SENDGRID_VERIFIED_SENDER || 'noreply@bookstud.io';
const SITE_MANAGER_EMAIL = process.env.SITE_MANAGER_EMAIL || 'obedtest@tbn.tv';
const APP_NAME = 'BookStud.io';

// Modern HTML email template base
function createEmailTemplate(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f8fafc;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 32px 24px;
            text-align: center;
        }
        
        .header h1 {
            color: #ffffff;
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
        }
        
        .header p {
            color: #e2e8f0;
            font-size: 16px;
            font-weight: 400;
        }
        
        .content {
            padding: 32px 24px;
        }
        
        .alert-badge {
            display: inline-flex;
            align-items: center;
            padding: 8px 16px;
            border-radius: 9999px;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 24px;
        }
        
        .alert-high {
            background-color: #fef2f2;
            color: #dc2626;
            border: 1px solid #fecaca;
        }
        
        .alert-medium {
            background-color: #fffbeb;
            color: #d97706;
            border: 1px solid #fed7aa;
        }
        
        .alert-low {
            background-color: #f0fdf4;
            color: #16a34a;
            border: 1px solid #bbf7d0;
        }
        
        .booking-card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 24px;
            margin: 24px 0;
        }
        
        .booking-title {
            font-size: 20px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 16px;
        }
        
        .booking-details {
            display: grid;
            gap: 12px;
        }
        
        .detail-row {
            display: flex;
            align-items: flex-start;
            gap: 12px;
        }
        
        .detail-label {
            font-weight: 500;
            color: #6b7280;
            min-width: 80px;
            flex-shrink: 0;
        }
        
        .detail-value {
            color: #1f2937;
            font-weight: 400;
        }
        
        .studio-tag {
            display: inline-block;
            background-color: #ddd6fe;
            color: #5b21b6;
            padding: 4px 12px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            margin: 2px 4px 2px 0;
        }
        
        .status-tag {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .status-confirmed {
            background-color: #dcfce7;
            color: #166534;
        }
        
        .status-cancelled {
            background-color: #fef2f2;
            color: #dc2626;
        }
        
        .status-pending {
            background-color: #fef3c7;
            color: #92400e;
        }
        
        .message-text {
            font-size: 16px;
            line-height: 1.7;
            color: #374151;
            margin-bottom: 24px;
        }
        
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 600;
            margin: 24px 0;
            transition: transform 0.2s ease;
        }
        
        .cta-button:hover {
            transform: translateY(-1px);
        }
        
        .footer {
            background-color: #f8fafc;
            border-top: 1px solid #e2e8f0;
            padding: 24px;
            text-align: center;
        }
        
        .footer p {
            color: #6b7280;
            font-size: 14px;
            margin-bottom: 8px;
        }
        
        .footer a {
            color: #667eea;
            text-decoration: none;
        }
        
        .alert-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
            margin: 10px 0;
            text-align: center;
        }
        
        .alert-critical {
            background-color: #dc2626 !important;
            color: white !important;
        }
        
        ul.message-text {
            margin: 16px 0;
            padding-left: 20px;
        }
        
        ul.message-text li {
            margin: 8px 0;
            line-height: 1.6;
        }
        
        @media (max-width: 600px) {
            .email-container {
                margin: 0;
                border-radius: 0;
            }
            
            .header,
            .content,
            .footer {
                padding: 24px 16px;
            }
            
            .detail-row {
                flex-direction: column;
                gap: 4px;
            }
            
            .detail-label {
                min-width: auto;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        ${content}
        <div class="footer">
            <p>This email was sent by ${APP_NAME}</p>
            <p>© ${new Date().getFullYear()} The Plex Studios. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
}

// Helper function to format studios list
function formatStudios(studioNames: string[]): string {
  if (!studioNames || studioNames.length === 0) return 'No studios assigned';
  return studioNames.map(name => `<span class="studio-tag">${name}</span>`).join('');
}

// Helper function to create status tag
function createStatusTag(status: string): string {
  const statusClass = status?.toLowerCase() === 'cancelled' ? 'status-cancelled' : 
                     status?.toLowerCase() === 'pending' ? 'status-pending' : 'status-confirmed';
  return `<span class="status-tag ${statusClass}">${status || 'Confirmed'}</span>`;
}

// Helper function to create severity badge
function createSeverityBadge(severity: string): string {
  const severityClass = severity?.toLowerCase() === 'high' ? 'alert-high' : 
                       severity?.toLowerCase() === 'medium' ? 'alert-medium' : 'alert-low';
  return `<div class="alert-badge ${severityClass}">${severity || 'Medium'} Priority</div>`;
}

// Import the notification group service to get site management group
import { getSiteManagementGroup } from './notificationGroupService';

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
    
    const text = `
      SITE MANAGER NOTIFICATION
      
      A studio booking has been ${action}:
      
      - Studio: ${studio.name}
      - Title: ${booking.title}
      - From: ${formatDate(booking.start)}
      - To: ${formatDate(booking.end)}
      ${booking.description ? `- Description: ${booking.description}` : ''}
      ${booking.status ? `- Status: ${booking.status}` : ''}
      - User: ${user.name} (${user.email})
      
      This is an automated notification sent to all site managers.
      
      Thank you,
      BookStud.io
    `;
    
    return sendEmail({
      to: siteManagementGroup.email,
      from: FROM_EMAIL,
      subject,
      text,
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
  
  const htmlContent = `
    <div class="header">
        <h1>${APP_NAME}</h1>
        <p>Studio Booking Confirmation</p>
    </div>
    <div class="content">
        <p class="message-text">Hello <strong>${user.name}</strong>,</p>
        <p class="message-text">Your studio booking has been confirmed and is ready for production.</p>
        
        <div class="booking-card">
            <div class="booking-title">${booking.title}</div>
            <div class="booking-details">
                <div class="detail-row">
                    <span class="detail-label">Studio:</span>
                    <span class="detail-value">${formatStudios([studio.name])}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Start:</span>
                    <span class="detail-value">${formatDate(booking.start)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">End:</span>
                    <span class="detail-value">${formatDate(booking.end)}</span>
                </div>
                ${booking.description ? `
                <div class="detail-row">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value">${booking.description}</span>
                </div>` : ''}
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value">${createStatusTag(booking.status || 'confirmed')}</span>
                </div>
            </div>
        </div>
        
        <p class="message-text">You can view and manage all your bookings by logging into your ${APP_NAME} account.</p>
        
        <p class="message-text">If you need to make any changes or have questions about your booking, please contact the studio management team.</p>
    </div>
  `;

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
  
  const htmlContent = `
    <div class="header">
        <h1>${APP_NAME}</h1>
        <p>Studio Booking Updated</p>
    </div>
    <div class="content">
        <p class="message-text">Hello <strong>${user.name}</strong>,</p>
        <p class="message-text">Your studio booking has been updated with new details.</p>
        
        <div class="booking-card">
            <div class="booking-title">${booking.title}</div>
            <div class="booking-details">
                <div class="detail-row">
                    <span class="detail-label">Studio:</span>
                    <span class="detail-value">${formatStudios([studio.name])}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Start:</span>
                    <span class="detail-value">${formatDate(booking.start)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">End:</span>
                    <span class="detail-value">${formatDate(booking.end)}</span>
                </div>
                ${booking.description ? `
                <div class="detail-row">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value">${booking.description}</span>
                </div>` : ''}
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value">${createStatusTag(booking.status || 'confirmed')}</span>
                </div>
            </div>
        </div>
        
        <p class="message-text">Please review the updated information and ensure it meets your production requirements.</p>
        
        <p class="message-text">You can view and manage all your bookings by logging into your ${APP_NAME} account.</p>
    </div>
  `;

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
  const subject = `${APP_NAME} - Studio Booking Cancelled`;
  
  const htmlContent = `
    <div class="header">
        <h1>${APP_NAME}</h1>
        <p>Studio Booking Cancelled</p>
    </div>
    <div class="content">
        <p class="message-text">Hello <strong>${user.name}</strong>,</p>
        <p class="message-text">We're writing to inform you that your studio booking has been cancelled.</p>
        
        <div class="booking-card">
            <div class="booking-title">${booking.title}</div>
            <div class="booking-details">
                <div class="detail-row">
                    <span class="detail-label">Studio:</span>
                    <span class="detail-value">${formatStudios([studio.name])}</span>
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
                    <span class="detail-label">Status:</span>
                    <span class="detail-value">${createStatusTag('cancelled')}</span>
                </div>
            </div>
        </div>
        
        <div class="alert-badge alert-medium">Important Notice</div>
        <p class="message-text">If you did not request this cancellation, please contact the studio management team immediately.</p>
        
        <p class="message-text">You can view all your bookings and create new ones by logging into your ${APP_NAME} account.</p>
    </div>
  `;

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
  
  const htmlContent = `
    <div class="header">
        <h1>${APP_NAME}</h1>
        <p>Maintenance Alert</p>
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
      <div class="header">
          <h1>${APP_NAME}</h1>
          <p>Maintenance Alert - Site Manager Notification</p>
      </div>
      <div class="content">
          ${createSeverityBadge(booking.severity || 'Medium')}
          
          <p class="message-text"><strong>Site Manager Alert</strong></p>
          <p class="message-text">A maintenance event has been scheduled that requires your attention.</p>
          
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
          
          <div class="alert-badge alert-high">Management Action Required</div>
          <p class="message-text">As a site manager, please ensure all affected teams are notified and coordinate with facilities management.</p>
          
          <p class="message-text">This is an automated notification sent to all site managers.</p>
      </div>
    `;

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
  
  const htmlContent = `
    <div class="header">
        <h1>${APP_NAME}</h1>
        <p>IMPORTANT: Facility-Wide Alert</p>
    </div>
    <div class="content">
        ${createSeverityBadge(booking.severity || 'High')}
        
        <p class="message-text"><strong>FACILITY-WIDE ALERT</strong></p>
        <p class="message-text">An important facility-wide alert has been issued that affects all studios and facilities.</p>
        
        <div class="booking-card">
            <div class="booking-title">${booking.title}</div>
            <div class="booking-details">
                <div class="detail-row">
                    <span class="detail-label">Type:</span>
                    <span class="detail-value">${booking.type}</span>
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
                    <span class="detail-value">${booking.severity || 'High'}</span>
                </div>
                ${booking.description ? `
                <div class="detail-row">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value">${booking.description}</span>
                </div>` : ''}
            </div>
        </div>
        
        <div class="alert-badge alert-high">URGENT: All Facilities Affected</div>
        <p class="message-text">This alert affects all studio operations. Please review your production schedules and coordinate with the facilities management team immediately.</p>
        
        <p class="message-text">Contact the facilities management team if you have any questions or concerns about this alert.</p>
    </div>
  `;

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
      <div class="header">
          <h1>${APP_NAME}</h1>
          <p>CRITICAL: Facility-Wide Alert - Site Manager Notification</p>
      </div>
      <div class="content">
          ${createSeverityBadge(booking.severity || 'High')}
          
          <p class="message-text"><strong>CRITICAL FACILITY-WIDE ALERT</strong></p>
          <p class="message-text">An urgent facility-wide alert requires immediate site manager attention and action.</p>
          
          <div class="booking-card">
              <div class="booking-title">${booking.title}</div>
              <div class="booking-details">
                  <div class="detail-row">
                      <span class="detail-label">Type:</span>
                      <span class="detail-value">${booking.type}</span>
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
                      <span class="detail-value">${booking.severity || 'High'}</span>
                  </div>
                  ${booking.description ? `
                  <div class="detail-row">
                      <span class="detail-label">Description:</span>
                      <span class="detail-value">${booking.description}</span>
                  </div>` : ''}
              </div>
          </div>
          
          <div class="alert-badge alert-critical">CRITICAL: Site Manager Action Required</div>
          <p class="message-text">As a site manager, you must:</p>
          <ul class="message-text">
              <li>Immediately assess impact on all studio operations</li>
              <li>Coordinate with all department heads and production teams</li>
              <li>Implement emergency protocols as necessary</li>
              <li>Ensure all staff are notified of this facility-wide alert</li>
          </ul>
          
          <p class="message-text">This is an automated notification sent to all site managers.</p>
      </div>
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