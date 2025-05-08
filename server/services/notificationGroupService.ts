import { MailService } from '@sendgrid/mail';
import type { User, Booking, Studio, NotificationGroup } from '@shared/schema';
import { format } from 'date-fns';
import { storage } from '../storage';

// Use the existing email service functions
import { sendEmail } from './emailService';

// Format date helper (copied from emailService to avoid circular imports)
function formatDate(date: Date): string {
  return format(new Date(date), 'EEEE, MMMM d, yyyy - h:mm a');
}

// Constants
const FROM_EMAIL = process.env.SENDGRID_VERIFIED_SENDER || 'noreply@bookstud.io';
const APP_NAME = 'BookStud.io';

/**
 * Send an email to all members of specified notification groups
 * @param groupIds Array of notification group IDs
 * @param subject Email subject
 * @param message Email message
 * @returns Promise resolving to an array of sending results
 */
export async function sendEmailToGroups(
  groupIds: number[],
  subject: string,
  message: string
): Promise<boolean[]> {
  try {
    // Get all notification groups
    const groups = await Promise.all(
      groupIds.map(id => storage.getNotificationGroup(id))
    );
    
    // Filter out any undefined groups (in case some don't exist)
    const validGroups = groups.filter(group => group && group.enabled) as NotificationGroup[];
    
    console.log(`Sending emails to ${validGroups.length} notification groups`);
    
    // Send emails to each group
    const emailPromises = validGroups.map(group => {
      console.log(`Sending email to group: ${group.name} (${group.email})`);
      
      return sendEmail({
        to: group.email,
        from: FROM_EMAIL,
        subject,
        text: message,
      });
    });
    
    return Promise.all(emailPromises);
  } catch (error) {
    console.error('Error sending emails to notification groups:', error);
    return [false]; // Return a failed result
  }
}

/**
 * Send a booking notification to specified notification groups
 * @param booking The booking information
 * @param studio The studio information
 * @param groupIds Array of notification group IDs
 * @param action The action taken (created, updated, cancelled)
 * @returns Promise resolving to an array of sending results
 */
export async function sendBookingNotificationToGroups(
  booking: Booking,
  studio: Studio | null,
  groupIds: number[],
  action: 'created' | 'updated' | 'cancelled'
): Promise<boolean[]> {
  const actionText = action.charAt(0).toUpperCase() + action.slice(1);
  const subject = `${APP_NAME} - Studio Booking ${actionText}`;
  
  const studioName = studio ? studio.name : 'Multiple Studios';
  
  const message = `
    BOOKING ${actionText.toUpperCase()}
    
    A studio booking has been ${action}:
    
    - Studio: ${studioName}
    - Title: ${booking.title}
    - From: ${formatDate(booking.start)}
    - To: ${formatDate(booking.end)}
    ${booking.description ? `- Description: ${booking.description}` : ''}
    ${booking.status ? `- Status: ${booking.status}` : ''}
    
    This notification has been sent to your notification group.
    
    Thank you,
    BookStud.io
  `;
  
  return sendEmailToGroups(groupIds, subject, message);
}

/**
 * Send a maintenance alert to specified notification groups
 * @param booking The maintenance event information
 * @param groupIds Array of notification group IDs
 * @returns Promise resolving to an array of sending results
 */
export async function sendMaintenanceAlertToGroups(
  booking: Booking,
  groupIds: number[]
): Promise<boolean[]> {
  const subject = `${APP_NAME} - Maintenance Alert`;
  
  const message = `
    MAINTENANCE ALERT
    
    A maintenance event has been scheduled:
    
    - Title: ${booking.title}
    - Type: Maintenance
    - Severity: ${booking.severity || 'Medium'}
    - From: ${formatDate(booking.start)}
    - To: ${formatDate(booking.end)}
    ${booking.description ? `- Description: ${booking.description}` : ''}
    
    This may affect studio availability. Please plan accordingly.
    
    This notification has been sent to your notification group.
    
    Thank you,
    BookStud.io
  `;
  
  return sendEmailToGroups(groupIds, subject, message);
}

/**
 * Send a facility-wide alert to specified notification groups
 * @param booking The facility alert information
 * @param groupIds Array of notification group IDs
 * @returns Promise resolving to an array of sending results
 */
export async function sendFacilityAlertToGroups(
  booking: Booking,
  groupIds: number[]
): Promise<boolean[]> {
  const subject = `${APP_NAME} - IMPORTANT: Facility-Wide Alert`;
  
  const message = `
    FACILITY-WIDE ALERT
    
    An important facility-wide alert has been issued:
    
    - Title: ${booking.title}
    - Type: ${booking.type}
    - Severity: ${booking.severity || 'High'}
    - From: ${formatDate(booking.start)}
    - To: ${formatDate(booking.end)}
    ${booking.description ? `- Description: ${booking.description}` : ''}
    
    This affects all studios and facilities. Please plan accordingly.
    
    This notification has been sent to your notification group.
    
    Thank you,
    BookStud.io
  `;
  
  return sendEmailToGroups(groupIds, subject, message);
}

/**
 * Send a custom notification to specified notification groups
 * @param subject Email subject
 * @param message Email message
 * @param groupIds Array of notification group IDs
 * @returns Promise resolving to an array of sending results
 */
export async function sendCustomNotificationToGroups(
  subject: string,
  message: string,
  groupIds: number[]
): Promise<boolean[]> {
  return sendEmailToGroups(groupIds, subject, message);
}