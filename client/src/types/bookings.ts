/**
 * Type definitions for bookings in BookStud.io
 */

// Booking types
export type BookingType = 'recording' | 'live' | 'maintenance' | 'other' | 'production';

// Booking status
export type BookingStatus = 'confirmed' | 'pending' | 'cancelled' | 'draft';

// Booking severity - REMOVED: Only used for alerts, not production bookings

// API Booking data
export interface ApiBooking {
  id: number;
  title: string;
  description: string | null;
  studioId: number | null;
  pcrRoomId: number | null;
  userId: number;
  start: string;
  end: string;
  type: BookingType;
  templateId: number | null;
  notifyList: string[];
  createdAt?: string;
  status: BookingStatus;
  // severity: REMOVED - production bookings don't use severity
  color: string | null;
  studioIds?: number[]; // Used for multiple studio bookings
}

// Booking form data
export interface FormBookingData {
  id: number;
  title: string;
  description: string;
  studioId: number | null;
  studioIds: number[]; // Multiple studio selection
  pcrRoomId: number | null;
  start: Date;
  end: Date;
  type: BookingType;
  templateId: number | null;
  status: BookingStatus;
  // severity: REMOVED - production bookings don't use severity
  color: string;
  notifyList: string[];
}

// Booking studio link
export interface BookingStudioLink {
  id: number;
  bookingId: number;
  studioId: number;
}

// Booking calendar event
export interface CalendarEvent {
  id: number | string;
  title: string;
  start: Date;
  end: Date;
  color?: string;
  booking?: ApiBooking;
  studioId?: number;
  pcrRoomId?: number | null;
  allDay?: boolean;
  editable?: boolean;
}