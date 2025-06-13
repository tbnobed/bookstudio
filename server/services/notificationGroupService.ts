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
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f8fafc;
                color: #334155;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                overflow: hidden;
            }
            .header {
                background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
                color: white;
                padding: 32px 24px;
                text-align: center;
            }
            .header h1 {
                margin: 0;
                font-size: 28px;
                font-weight: 700;
                letter-spacing: -0.025em;
            }
            .header p {
                margin: 8px 0 0;
                font-size: 16px;
                opacity: 0.9;
            }
            .content {
                padding: 32px 24px;
                line-height: 1.6;
            }
            .message-text {
                font-size: 16px;
                margin: 16px 0;
                color: #475569;
                background-color: #f8fafc;
                padding: 16px;
                border-radius: 8px;
            }
            .booking-title {
                color: #1e40af;
                font-size: 24px;
                font-weight: 700;
                margin: 0 0 24px 0;
            }
            .booking-details {
                margin-bottom: 24px;
            }
            .detail-row {
                display: flex;
                justify-content: space-between;
                padding: 12px 0;
                border-bottom: 1px solid #f1f5f9;
            }
            .detail-row:last-child {
                border-bottom: none;
            }
            .label {
                font-weight: 600;
                color: #475569;
                flex: 0 0 120px;
            }
            .value {
                color: #334155;
                flex: 1;
                text-align: right;
            }
            .booking-card {
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 24px;
                margin: 20px 0;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            .booking-title {
                font-size: 18px;
                font-weight: 600;
                color: #1e293b;
                margin-bottom: 16px;
                border-bottom: 2px solid #e2e8f0;
                padding-bottom: 8px;
            }
            .booking-details {
                margin-top: 16px;
            }
            .detail-row {
                margin-bottom: 8px;
                display: flex;
                align-items: center;
            }
            .detail-label {
                font-weight: 600;
                color: #64748b;
                min-width: 100px;
                margin-right: 12px;
                font-size: 14px;
            }
            .detail-value {
                color: #1e293b;
                font-size: 14px;
                flex: 1;
            }
            .alert-badge {
                display: inline-block;
                padding: 8px 16px;
                border-radius: 6px;
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 20px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            .status-tag {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            .status-confirmed { background: #dcfce7; color: #166534; }
            .status-pending { background: #fef3c7; color: #92400e; }
            .status-cancelled { background: #fecaca; color: #b91c1c; }
            .severity-low { background: #dbeafe; color: #1e40af; }
            .severity-medium { background: #fef3c7; color: #92400e; }
            .severity-high { background: #fecaca; color: #b91c1c; }
            .footer {
                background: #f8fafc;
                padding: 24px;
                text-align: center;
                font-size: 14px;
                color: #64748b;
                border-top: 1px solid #e2e8f0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            ${content}
            <div class="footer">
                <p>This is an automated notification from ${APP_NAME}</p>
                <p>Please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
  `;
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
    
    // Find the site management group (groupType: 'facility')
    const siteManagementGroup = allGroups.find(group => 
      group.groupType === 'facility' && 
      group.name.toLowerCase().includes('site management') &&
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
    
    console.log(`Sending emails to ${validGroups.length} notification groups`);
    
    // Send emails to each group
    const emailPromises = validGroups.map(group => {
      console.log(`Sending email to group: ${group.name} (${group.email})`);
      
      // Always use plain text for notification group emails to avoid SendGrid formatting issues
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
  
  // Create plain text message for reliable delivery
  const textMessage = `
    Studio Booking ${actionText}
    
    A booking has been ${action}:
    
    - Studio: ${studioName}
    - Title: ${booking.title}
    - From: ${formatDate(booking.start)}
    - To: ${formatDate(booking.end)}
    ${booking.description ? `- Description: ${booking.description}` : ''}
    ${booking.status ? `- Status: ${booking.status}` : ''}
    
    This notification has been sent to your notification group.
    
    Thank you,
    ${APP_NAME}
  `;
  
  return sendEmailToGroups(groupIds, subject, textMessage, alwaysNotifySiteManagers);
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
  
  // Create modern HTML email content
  const header = `
    <div class="header">
      <h1>🔧 Maintenance Alert</h1>
      <p>A maintenance event has been scheduled</p>
    </div>
  `;
  
  const content = `
    ${header}
    <div class="content">
      <div class="alert-badge" style="background: #fef3c7; color: #92400e;">
        MAINTENANCE SCHEDULED
      </div>
      
      <div class="booking-card">
        <div class="booking-title">${booking.title}</div>
        <div class="booking-details">
          <div class="detail-row">
            <div class="detail-label">Type:</div>
            <div class="detail-value">Maintenance</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Severity:</div>
            <div class="detail-value">${createSeverityBadge(booking.severity || 'medium')}</div>
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
      
      <p class="message-text">
        <strong>⚠️ Important:</strong> This maintenance may affect studio availability. Please plan accordingly.
      </p>
      <p class="message-text">This notification has been sent to your notification group.</p>
    </div>
  `;
  
  const maintenanceHtmlMessage = createEmailTemplate(content, subject);
  
  return sendEmailToGroups(groupIds, subject, maintenanceHtmlMessage, alwaysNotifySiteManagers);
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
  
  // Create modern HTML email content
  const header = `
    <div class="header">
      <h1>🚨 Facility-Wide Alert</h1>
      <p>An important facility-wide alert has been issued</p>
    </div>
  `;
  
  const content = `
    ${header}
    <div class="content">
      <div class="alert-badge" style="background: #fecaca; color: #b91c1c;">
        FACILITY-WIDE ALERT
      </div>
      
      <div class="booking-card">
        <div class="booking-title">${booking.title}</div>
        <div class="booking-details">
          <div class="detail-row">
            <div class="detail-label">Type:</div>
            <div class="detail-value">${booking.type}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">Severity:</div>
            <div class="detail-value">${createSeverityBadge(booking.severity || 'high')}</div>
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
      
      <p class="message-text">
        <strong>🚨 Critical:</strong> This alert affects all studios and facilities. Please take appropriate action immediately.
      </p>
      <p class="message-text">This notification has been sent to your notification group.</p>
    </div>
  `;
  
  const facilityHtmlMessage = createEmailTemplate(content, subject);
  
  return sendEmailToGroups(groupIds, subject, facilityHtmlMessage, alwaysNotifySiteManagers);
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
  return sendEmailToGroups(groupIds, subject, message, alwaysNotifySiteManagers);
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