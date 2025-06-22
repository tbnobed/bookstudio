import { MailService } from '@sendgrid/mail';
import type { User, Booking, Studio, NotificationGroup } from '@shared/schema';
import { format } from 'date-fns';
import { storage } from '../storage';

// Use the existing email service functions
import { sendEmail, sendBookingConfirmation } from './emailService';

// Format date helper for Chicago CDT timezone
function formatDate(date: Date | string): string {
  try {
    // Ensure we have a proper Date object
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    const chicagoDate = dateObj.toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    // Add CDT suffix for clarity
    return `${chicagoDate} CDT`;
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Date formatting error';
  }
}

// Format file size helper
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Constants
const FROM_EMAIL = process.env.SENDGRID_VERIFIED_SENDER || 'noreply@bookstud.io';
const APP_NAME = 'BookStud.io';

// Helper functions for modern email templates
function createEmailTemplate(content: string, title: string): string {
  // Use consistent domain resolution for logo URL
  const getApplicationUrl = () => {
    if (process.env.APP_DOMAIN) {
      return process.env.APP_DOMAIN;
    }
    if (process.env.REPLIT_DOMAINS) {
      const domains = process.env.REPLIT_DOMAINS.split(',').map(d => d.trim());
      return `https://${domains[0]}`;
    }
    if (process.env.REPLIT_DEV_DOMAIN) {
      return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }
    const port = process.env.PORT || 5000;
    return `http://localhost:${port}`;
  };
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

function formatStudios(studioNames: string[]): string {
  if (studioNames.length === 0) return 'No studios';
  if (studioNames.length === 1) return studioNames[0];
  if (studioNames.length === 2) return studioNames.join(' and ');
  return studioNames.slice(0, -1).join(', ') + ', and ' + studioNames[studioNames.length - 1];
}

function createStatusTag(status: string): string {
  const statusClass = `status-${status.toLowerCase()}`;
  return `<span class="status-tag ${statusClass}">${status.toUpperCase()}</span>`;
}

function createSeverityBadge(severity: string): string {
  const severityClass = `severity-${severity.toLowerCase()}`;
  return `<span class="status-tag ${severityClass}">${severity.toUpperCase()}</span>`;
}

/**
 * Get the site management notification group
 * @returns Promise resolving to the site management notification group or null if not found
 */
export async function getSiteManagementGroup(): Promise<NotificationGroup | null> {
  try {
    // Get all notification groups
    const allGroups = await storage.getAllNotificationGroups();
    
    // Find the site management group
    const siteManagementGroup = allGroups.find(group => 
      (group.groupType === 'site_management' || group.groupType === 'facility') && 
      group.enabled
    );
    
    console.log('Site management group found:', siteManagementGroup?.name || 'Not found');
    
    return siteManagementGroup || null;
  } catch (error) {
    console.error('Error fetching site management group:', error);
    return null;
  }
}

/**
 * Send an email to all members of specified notification groups
 * @param groupIds Array of notification group IDs
 * @param subject Email subject
 * @param message Email message
 * @param alwaysNotifySiteManagers If true, always includes site management group (default: true)
 * @returns Promise resolving to an array of sending results
 */
export async function sendEmailToGroups(
  groupIds: number[],
  subject: string,
  message: string,
  alwaysNotifySiteManagers: boolean = true
): Promise<boolean[]> {
  try {
    console.log(`[NotificationGroupService] Attempting to send email to group IDs: ${groupIds.join(', ')}`);
    
    // Get all notification groups from the provided IDs
    const groups = await Promise.all(
      groupIds.map(id => storage.getNotificationGroup(id))
    );
    
    console.log(`[NotificationGroupService] Fetched groups:`, groups.map(g => g ? `${g.name} (${g.email}, enabled: ${g.enabled})` : 'null'));
    
    // Filter out any undefined groups (in case some don't exist)
    let validGroups = groups.filter(group => group && group.enabled) as NotificationGroup[];
    
    // Add site management group if not already included and alwaysNotifySiteManagers is true
    if (alwaysNotifySiteManagers) {
      const siteManagementGroup = await getSiteManagementGroup();
      
      if (siteManagementGroup) {
        // Check if site management group is already in the list
        const alreadyIncluded = validGroups.some(group => group.id === siteManagementGroup.id);
        
        if (!alreadyIncluded) {
          console.log(`Adding site management group '${siteManagementGroup.name}' to notification recipients`);
          validGroups.push(siteManagementGroup);
        }
      }
    }
    
    // Remove any duplicate groups (by ID)
    validGroups = validGroups.filter((group, index, self) => 
      index === self.findIndex(g => g.id === group.id)
    );
    
    console.log(`[NotificationService] Sending emails to ${validGroups.length} notification groups`);
    
    // Send emails to each group
    const emailPromises = validGroups.map(group => {
      console.log(`[NotificationService] Preparing email for group: ${group.name} (${group.email})`);
      
      // Always use plain text for notification group emails to avoid SendGrid formatting issues
      const emailParams = {
        to: group.email,
        from: FROM_EMAIL,
        subject,
        text: message,
      };
      
      console.log(`[NotificationService] Email params for ${group.name}:`, {
        to: emailParams.to,
        from: emailParams.from,
        subject: emailParams.subject,
        textLength: emailParams.text?.length
      });
      
      return sendEmail(emailParams);
    });
    
    console.log(`[NotificationService] Created ${emailPromises.length} email promises`);
    const results = await Promise.all(emailPromises);
    console.log(`[NotificationService] Email results:`, results);
    return results;
  } catch (error) {
    console.error('Error sending emails to notification groups:', error);
    return [false]; // Return a failed result
  }
}

/**
 * Send styled HTML emails to notification groups with fallback plain text
 * @param groupIds Array of notification group IDs
 * @param subject Email subject
 * @param htmlContent HTML email content
 * @param textContent Plain text fallback content
 * @param alwaysNotifySiteManagers If true, always includes site management group (default: true)
 * @returns Promise resolving to an array of sending results
 */
export async function sendStyledEmailToGroups(
  groupIds: number[],
  subject: string,
  htmlContent: string,
  textContent: string,
  alwaysNotifySiteManagers: boolean = true
): Promise<boolean[]> {
  try {
    console.log(`[NotificationGroupService] Sending styled emails to group IDs: ${groupIds.join(', ')}`);
    
    // Get all notification groups from the provided IDs
    const groups = await Promise.all(
      groupIds.map(id => storage.getNotificationGroup(id))
    );
    
    console.log(`[NotificationGroupService] Fetched groups:`, groups.map(g => g ? `${g.name} (${g.email}, enabled: ${g.enabled})` : 'null'));
    
    // Filter out any undefined groups (in case some don't exist)
    let validGroups = groups.filter(group => group && group.enabled) as NotificationGroup[];
    
    // Add site management group if not already included and alwaysNotifySiteManagers is true
    if (alwaysNotifySiteManagers) {
      const siteManagementGroup = await getSiteManagementGroup();
      
      if (siteManagementGroup) {
        // Check if site management group is already in the list
        const alreadyIncluded = validGroups.some(group => group.id === siteManagementGroup.id);
        
        if (!alreadyIncluded) {
          console.log(`Adding site management group '${siteManagementGroup.name}' to notification recipients`);
          validGroups.push(siteManagementGroup);
        }
      }
    }
    
    // Remove any duplicate groups (by ID)
    validGroups = validGroups.filter((group, index, self) => 
      index === self.findIndex(g => g.id === group.id)
    );
    
    console.log(`Sending styled emails to ${validGroups.length} notification groups`);
    
    // Send emails to each group
    const emailPromises = validGroups.map(group => {
      console.log(`Sending styled email to group: ${group.name} (${group.email})`);
      
      return sendEmail({
        to: group.email,
        from: FROM_EMAIL,
        subject,
        text: textContent,
        html: createEmailTemplate(htmlContent, subject),
      });
    });
    
    return Promise.all(emailPromises);
  } catch (error) {
    console.error('Error sending styled emails to notification groups:', error);
    return [false]; // Return a failed result
  }
}

/**
 * Send a booking notification to specified notification groups
 * @param booking The booking information
 * @param studio The studio information
 * @param groupIds Array of notification group IDs
 * @param action The action taken (created, updated, cancelled)
 * @param alwaysNotifySiteManagers If true, always includes site management group (default: true)
 * @returns Promise resolving to an array of sending results
 */
export async function sendBookingNotificationToGroups(
  booking: Booking,
  studio: Studio | null,
  groupIds: number[],
  action: 'created' | 'updated' | 'cancelled',
  alwaysNotifySiteManagers: boolean = true
): Promise<boolean[]> {
  console.log(`[NotificationGroupService] ===== BOOKING NOTIFICATION START =====`);
  console.log(`[NotificationGroupService] Booking ID: ${booking.id}, Action: ${action}`);
  console.log(`[NotificationGroupService] Group IDs to notify:`, groupIds);
  console.log(`[NotificationGroupService] Studio:`, studio ? studio.name : 'null');
  console.log(`[NotificationGroupService] Always notify site managers: ${alwaysNotifySiteManagers}`);
  
  const actionText = action.charAt(0).toUpperCase() + action.slice(1);
  const subject = `${APP_NAME} - Studio Booking ${actionText}`;
  
  const studioName = studio ? studio.name : 'Multiple Studios';
  
  const actionColors = {
    created: '#10b981',
    updated: '#f59e0b', 
    cancelled: '#ef4444'
  };
  
  // Get application URL for booking links
  const getApplicationUrl = () => {
    if (process.env.REPLIT_DEV_DOMAIN) {
      return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }
    if (process.env.APP_DOMAIN) {
      return process.env.APP_DOMAIN;
    }
    const port = process.env.PORT || 5000;
    return `http://localhost:${port}`;
  };

  const appUrl = getApplicationUrl();
  const bookingUrl = `${appUrl}/?booking=${booking.id}`;

  // Get logo URL using consistent domain resolution
  const logoUrl = `${appUrl}/assets/logo.png`;

  // Create modern HTML content for booking notification
  const htmlContent = `
                    <tr>
                        <td style="padding: 32px 24px; text-align: center;">
                            <img src="${logoUrl}" alt="BookStud.io Logo" style="height: 80px; width: auto; margin-bottom: 24px;" />
                            <div style="text-align: center; margin: 24px 0;">
                                <a href="${bookingUrl}" style="display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">View Booking Details</a>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 32px 24px;">
                            <div style="background-color: ${actionColors[action]}; color: white; padding: 12px 20px; border-radius: 6px; display: inline-block; margin-bottom: 24px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">${actionText}</div>
                            
                            <h2 style="color: #1f2937; font-size: 24px; font-weight: 700; margin: 0 0 20px 0;">${booking.title}</h2>
                            
                            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                                <div style="margin-bottom: 12px;">
                                    <strong style="color: #4b5563; display: inline-block; width: 100px;">Studio:</strong>
                                    <span style="color: #1f2937;">${studioName}</span>
                                </div>
                                <div style="margin-bottom: 12px;">
                                    <strong style="color: #4b5563; display: inline-block; width: 100px;">Start:</strong>
                                    <span style="color: #1f2937;">${formatDate(booking.start)}</span>
                                </div>
                                <div style="margin-bottom: 12px;">
                                    <strong style="color: #4b5563; display: inline-block; width: 100px;">End:</strong>
                                    <span style="color: #1f2937;">${formatDate(booking.end)}</span>
                                </div>
                                <div style="margin-bottom: 12px;">
                                    <strong style="color: #4b5563; display: inline-block; width: 100px;">Type:</strong>
                                    <span style="color: #1f2937;">${booking.type}</span>
                                </div>
                                <div style="margin-bottom: 12px;">
                                    <strong style="color: #4b5563; display: inline-block; width: 100px;">Status:</strong>
                                    <span style="color: #1f2937;">${booking.status || 'pending'}</span>
                                </div>
                                ${booking.description ? `
                                <div style="margin-bottom: 12px;">
                                    <strong style="color: #4b5563; display: inline-block; width: 100px;">Description:</strong>
                                    <span style="color: #1f2937;">${booking.description}</span>
                                </div>` : ''}
                            </div>
                            
                            <p style="color: #6b7280; font-size: 14px; margin: 20px 0;">A studio booking has been ${action}. This notification has been sent to your notification group.</p>
                        </td>
                    </tr>`;

  // Create plain text version for fallback
  const textMessage = `
    Studio Booking ${actionText}
    
    A booking has been ${action}:
    
    - Studio: ${studioName}
    - Title: ${booking.title}
    - From: ${formatDate(booking.start)}
    - To: ${formatDate(booking.end)}
    - Type: ${booking.type}
    - Status: ${booking.status || 'pending'}
    ${booking.description ? `- Description: ${booking.description}` : ''}
    
    This notification has been sent to your notification group.
    
    Thank you,
    ${APP_NAME}
  `;
  
  return sendStyledEmailToGroups(groupIds, subject, htmlContent, textMessage, alwaysNotifySiteManagers);
}

/**
 * Send a maintenance alert to specified notification groups
 * @param booking The maintenance event information
 * @param groupIds Array of notification group IDs
 * @param alwaysNotifySiteManagers If true, always includes site management group (default: true)
 * @returns Promise resolving to an array of sending results
 */
export async function sendMaintenanceAlertToGroups(
  booking: Booking,
  groupIds: number[],
  alwaysNotifySiteManagers: boolean = true
): Promise<boolean[]> {
  const subject = `${APP_NAME} - Maintenance Alert`;
  
  // Get logo URL using consistent domain resolution
  const logoUrl = `${getApplicationUrl()}/assets/logo.png`;

  // Create modern HTML content for maintenance alert
  const htmlContent = `
                    <tr>
                        <td style="padding: 32px 24px; text-align: center;">
                            <img src="${logoUrl}" alt="BookStud.io Logo" style="height: 80px; width: auto; margin-bottom: 24px;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 32px 24px;">
                            <div style="background-color: #f59e0b; color: white; padding: 12px 20px; border-radius: 6px; display: inline-block; margin-bottom: 24px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">MAINTENANCE SCHEDULED</div>
                            
                            <h2 style="color: #1f2937; font-size: 24px; font-weight: 700; margin: 0 0 20px 0;">${booking.title}</h2>
                            
                            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                                <div style="margin-bottom: 12px;">
                                    <strong style="color: #4b5563; display: inline-block; width: 100px;">Type:</strong>
                                    <span style="color: #1f2937;">Maintenance</span>
                                </div>
                                <div style="margin-bottom: 12px;">
                                    <strong style="color: #4b5563; display: inline-block; width: 100px;">Severity:</strong>
                                    <span style="color: #1f2937;">${booking.severity || 'medium'}</span>
                                </div>
                                <div style="margin-bottom: 12px;">
                                    <strong style="color: #4b5563; display: inline-block; width: 100px;">Start:</strong>
                                    <span style="color: #1f2937;">${formatDate(booking.start)}</span>
                                </div>
                                <div style="margin-bottom: 12px;">
                                    <strong style="color: #4b5563; display: inline-block; width: 100px;">End:</strong>
                                    <span style="color: #1f2937;">${formatDate(booking.end)}</span>
                                </div>
                                ${booking.description ? `
                                <div style="margin-bottom: 12px;">
                                    <strong style="color: #4b5563; display: inline-block; width: 100px;">Description:</strong>
                                    <span style="color: #1f2937;">${booking.description}</span>
                                </div>` : ''}
                            </div>
                            
                            <p style="color: #6b7280; font-size: 14px; margin: 20px 0;"><strong>⚠️ Important:</strong> This maintenance may affect studio availability. Please plan accordingly.</p>
                            <p style="color: #6b7280; font-size: 14px; margin: 20px 0;">This notification has been sent to your notification group.</p>
                        </td>
                    </tr>`;

  // Create plain text version for fallback
  const textMessage = `
    Maintenance Alert
    
    A maintenance event has been scheduled:
    
    - Title: ${booking.title}
    - Type: Maintenance
    - Severity: ${booking.severity || 'medium'}
    - Start: ${formatDate(booking.start)}
    - End: ${formatDate(booking.end)}
    ${booking.description ? `- Description: ${booking.description}` : ''}
    
    ⚠️ Important: This maintenance may affect studio availability. Please plan accordingly.
    
    This notification has been sent to your notification group.
    
    Thank you,
    ${APP_NAME}
  `;
  
  return sendStyledEmailToGroups(groupIds, subject, htmlContent, textMessage, alwaysNotifySiteManagers);
}

/**
 * Send a facility-wide alert to specified notification groups
 * @param booking The facility alert information
 * @param groupIds Array of notification group IDs
 * @param alwaysNotifySiteManagers If true, always includes site management group (default: true)
 * @returns Promise resolving to an array of sending results
 */
export async function sendFacilityAlertToGroups(
  booking: Booking,
  groupIds: number[],
  alwaysNotifySiteManagers: boolean = true
): Promise<boolean[]> {
  const subject = `${APP_NAME} - IMPORTANT: Facility-Wide Alert`;
  
  // Get logo URL using consistent domain resolution
  const logoUrl = `${getApplicationUrl()}/assets/logo.png`;

  // Create modern HTML content for facility alert
  const htmlContent = `
                    <tr>
                        <td style="padding: 32px 24px; text-align: center;">
                            <img src="${logoUrl}" alt="BookStud.io Logo" style="height: 80px; width: auto; margin-bottom: 24px;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 32px 24px;">
                            <div style="background-color: #dc2626; color: white; padding: 12px 20px; border-radius: 6px; display: inline-block; margin-bottom: 24px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">FACILITY-WIDE ALERT</div>
                            
                            <h2 style="color: #1f2937; font-size: 24px; font-weight: 700; margin: 0 0 20px 0;">${booking.title}</h2>
                            
                            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                                <div style="margin-bottom: 12px;">
                                    <strong style="color: #4b5563; display: inline-block; width: 100px;">Type:</strong>
                                    <span style="color: #1f2937;">${booking.type}</span>
                                </div>
                                <div style="margin-bottom: 12px;">
                                    <strong style="color: #4b5563; display: inline-block; width: 100px;">Severity:</strong>
                                    <span style="color: #1f2937;">${booking.severity || 'high'}</span>
                                </div>
                                <div style="margin-bottom: 12px;">
                                    <strong style="color: #4b5563; display: inline-block; width: 100px;">Start:</strong>
                                    <span style="color: #1f2937;">${formatDate(booking.start)}</span>
                                </div>
                                <div style="margin-bottom: 12px;">
                                    <strong style="color: #4b5563; display: inline-block; width: 100px;">End:</strong>
                                    <span style="color: #1f2937;">${formatDate(booking.end)}</span>
                                </div>
                                ${booking.description ? `
                                <div style="margin-bottom: 12px;">
                                    <strong style="color: #4b5563; display: inline-block; width: 100px;">Description:</strong>
                                    <span style="color: #1f2937;">${booking.description}</span>
                                </div>` : ''}
                            </div>
                            
                            <p style="color: #6b7280; font-size: 14px; margin: 20px 0;"><strong>Critical:</strong> This alert affects all studios and facilities. Please take appropriate action immediately.</p>
                            <p style="color: #6b7280; font-size: 14px; margin: 20px 0;">This notification has been sent to your notification group.</p>
                        </td>
                    </tr>`;

  // Create plain text version for fallback
  const textMessage = `
    FACILITY-WIDE ALERT
    
    An important facility-wide alert has been issued:
    
    - Title: ${booking.title}
    - Type: ${booking.type}
    - Severity: ${booking.severity || 'high'}
    - Start: ${formatDate(booking.start)}
    - End: ${formatDate(booking.end)}
    ${booking.description ? `- Description: ${booking.description}` : ''}
    
    CRITICAL: This alert affects all studios and facilities. Please take appropriate action immediately.
    
    This notification has been sent to your notification group.
    
    Thank you,
    ${APP_NAME}
  `;
  
  return sendStyledEmailToGroups(groupIds, subject, htmlContent, textMessage, alwaysNotifySiteManagers);
}

/**
 * Send a custom notification to specified notification groups
 * @param subject Email subject
 * @param message Email message
 * @param groupIds Array of notification group IDs
 * @param alwaysNotifySiteManagers If true, always includes site management group (default: true)
 * @returns Promise resolving to an array of sending results
 */
export async function sendCustomNotificationToGroups(
  subject: string,
  message: string,
  groupIds: number[],
  alwaysNotifySiteManagers: boolean = true
): Promise<boolean[]> {
  // Create stylized HTML content for custom notifications
  const htmlContent = `
    <div class="header">
        <h1>${APP_NAME}</h1>
        <p>Custom Notification</p>
    </div>
    <div class="content">
        <div class="alert-badge" style="background-color: #3b82f6; color: white;">
            NOTIFICATION
        </div>
        
        <div class="booking-card">
            <div class="booking-details">
                <p class="message-text">${message}</p>
            </div>
        </div>
        
        <p class="message-text">This notification has been sent to your notification group.</p>
    </div>
  `;

  return sendStyledEmailToGroups(groupIds, subject, htmlContent, message, alwaysNotifySiteManagers);
}

/**
 * Send a file attachment notification to specified notification groups
 * @param booking The booking the file was attached to
 * @param fileAttachment The file attachment details
 * @param uploadedBy The user who uploaded the file
 * @param groupIds Array of notification group IDs to send to
 * @param alwaysNotifySiteManagers Whether to always include site managers
 * @returns Promise<boolean[]> indicating success/failure for each group
 */
export async function sendFileAttachmentNotificationToGroups(
  booking: any,
  fileAttachment: any,
  uploadedBy: any,
  groupIds: number[],
  alwaysNotifySiteManagers: boolean = true
): Promise<boolean[]> {
  const subject = `${APP_NAME} - New File Attached: ${booking.title}`;
  
  // Create modern HTML email content
  const header = `
    <div class="header">
      <h1>📎 New File Attachment</h1>
      <p>A file has been uploaded to a booking</p>
    </div>
  `;
  
  const content = `
    ${header}
    <div class="content">
      <div class="alert-badge" style="background: #dbeafe; color: #1d4ed8;">
        FILE ATTACHMENT
      </div>
      
      <div class="booking-card">
        <div class="booking-title">${booking.title}</div>
        <div class="booking-details">
          <div class="detail-row">
            <div class="detail-label">Type:</div>
            <div class="detail-value">${booking.type}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Start Time:</div>
            <div class="detail-value">${formatDate(booking.start)}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">End Time:</div>
            <div class="detail-value">${formatDate(booking.end)}</div>
          </div>
          ${booking.description ? `
          <div class="detail-row">
            <div class="detail-label">Description:</div>
            <div class="detail-value">${booking.description}</div>
          </div>
          ` : ''}
        </div>
      </div>
      
      <div class="booking-card" style="border-left: 4px solid #1d4ed8;">
        <div class="booking-title" style="color: #1d4ed8;">File Details</div>
        <div class="booking-details">
          <div class="detail-row">
            <div class="detail-label">File Name:</div>
            <div class="detail-value">${fileAttachment.fileName}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">File Size:</div>
            <div class="detail-value">${formatFileSize(fileAttachment.fileSize)}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Uploaded By:</div>
            <div class="detail-value">${uploadedBy.name} (${uploadedBy.email})</div>
          </div>
          ${fileAttachment.description ? `
          <div class="detail-row">
            <div class="detail-label">Description:</div>
            <div class="detail-value">${fileAttachment.description}</div>
          </div>
          ` : ''}
        </div>
      </div>
      
      <p class="message-text">
        <strong>📎 Note:</strong> A new file has been attached to this booking. Team members can access it through the booking details.
      </p>
      <p class="message-text">This notification has been sent to your notification group.</p>
    </div>
  `;
  
  const customHtmlMessage = createEmailTemplate(content, subject);
  
  return sendEmailToGroups(groupIds, subject, customHtmlMessage, alwaysNotifySiteManagers);
}