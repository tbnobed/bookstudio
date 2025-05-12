/**
 * Type definitions for notification groups and notifications
 */

// Types of notifications
export type NotificationType = 'booking' | 'maintenance' | 'alert' | 'system';

// Notification group
export interface NotificationGroup {
  id: number;
  name: string;
  description: string | null;
  emails: string[];
  phoneNumbers: string[] | null;
  isDefault: boolean;
}

// Notification
export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  sentAt: string;
  groupId: number;
  bookingId: number | null;
  readBy: number[];
  sentBy: number;
}

// Notification group creation/edit form data
export interface NotificationGroupFormData {
  id?: number;
  name: string;
  description: string;
  emails: string[];
  phoneNumbers: string[];
  isDefault: boolean;
}

// Notification item for dropdown/display
export interface NotificationGroupItem {
  id: number;
  name: string;
  description: string | null;
  emails: string[];
}