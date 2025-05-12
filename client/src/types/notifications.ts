/**
 * Type definitions for notification system in BookStud.io
 */

// Notification group
export interface NotificationGroup {
  id: number;
  name: string;
  description: string | null;
  emails: string[];
  createdBy: number;
  createdAt: string;
}

// Notification preferences
export interface NotificationPreferences {
  userId: number;
  bookingCreated: boolean;
  bookingUpdated: boolean;
  bookingCancelled: boolean;
  bookingReminder: boolean;
  systemAlerts: boolean;
  maintenanceAlerts: boolean;
}

// Email notification data
export interface EmailNotification {
  to: string[];
  subject: string;
  templateId: string;
  dynamicTemplateData: Record<string, any>;
}

// Notification log entry
export interface NotificationLog {
  id: number;
  type: 'email' | 'sms' | 'system';
  recipients: string[];
  subject: string;
  content: string;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
  createdAt: string;
  sentAt?: string;
}

// Notification group creation/edit form data
export interface NotificationGroupFormData {
  id?: number;
  name: string;
  description: string;
  emails: string[];
}