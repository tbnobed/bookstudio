/**
 * Type definitions for notifications and notification groups
 */

/**
 * Notification group as returned from the API
 */
export interface NotificationGroup {
  id: number;
  name: string;
  description?: string;
  emails: string[];
}

/**
 * Notification as returned from the API
 */
export interface ApiNotification {
  id: number;
  userId: number;
  message: string;
  read: boolean;
  createdAt: string;
}