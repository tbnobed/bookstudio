// Notification related type definitions

// Notification group (email distribution list)
export interface NotificationGroup {
  id: number;
  name: string;
  description: string;
  emails: string[];
}

// Notification types
export type NotificationType = 'booking_created' | 'booking_updated' | 'booking_cancelled' | 'maintenance' | 'alert';

// Notification data structure
export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  targetId?: number; // ID of the related entity (booking, maintenance, etc.)
  userId: number;
}