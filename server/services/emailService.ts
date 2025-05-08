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
const APP_NAME = 'BookStud.io';

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
    })
  );
  
  // Always ensure site managers are notified of maintenance alerts
  if (siteManagementGroup) {
    console.log(`Sending maintenance alert to site management group: ${siteManagementGroup.name}`);
    
    // Send a more detailed message to site managers
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
    })
  );
  
  // Always ensure site managers are notified of facility alerts
  if (siteManagementGroup) {
    console.log(`Sending facility alert to site management group: ${siteManagementGroup.name}`);
    
    // Send a more detailed message to site managers
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
      })
    );
  }
  
  return Promise.all(userPromises);
}