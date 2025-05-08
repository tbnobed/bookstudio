import { MailService } from '@sendgrid/mail';
import type { User, Booking, Studio } from '@shared/schema';
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
      text: params.text,
      html: params.html || params.text,
    });
    
    console.log(`Email sent successfully to ${params.to}`);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

// Email templates
const FROM_EMAIL = 'noreply@bookstuio.com';
const APP_NAME = 'BookStud.io';

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
  
  return sendEmail({
    to: user.email,
    from: FROM_EMAIL,
    subject,
    text,
  });
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
  
  return sendEmail({
    to: user.email,
    from: FROM_EMAIL,
    subject,
    text,
  });
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
  
  return sendEmail({
    to: user.email,
    from: FROM_EMAIL,
    subject,
    text,
  });
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
  
  // Send emails to all affected users
  const promises = users.map(user => 
    sendEmail({
      to: user.email,
      from: FROM_EMAIL,
      subject,
      text,
    })
  );
  
  return Promise.all(promises);
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
  
  // Send emails to all users
  const promises = users.map(user => 
    sendEmail({
      to: user.email,
      from: FROM_EMAIL,
      subject,
      text,
    })
  );
  
  return Promise.all(promises);
}