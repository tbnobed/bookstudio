/**
 * Type definitions for bookings in the BookStud.io system
 */

// Booking type
export type BookingType = 'production' | 'maintenance' | 'private' | 'alert' | 'other';

// Booking status
export type BookingStatus = 'draft' | 'confirmed' | 'cancelled' | 'completed';

// Booking severity level
export type BookingSeverity = 'low' | 'medium' | 'high' | 'critical';

// API response booking data
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
  createdAt: string;
  status: BookingStatus;
  severity: BookingSeverity;
  color: string | null;
}

// Booking with linked studios data
export interface BookingWithStudios extends ApiBooking {
  studioIds: number[];
  studios?: { id: number; name: string }[];
}

// Form data for booking creation/editing
export interface FormBookingData {
  id: number;
  title: string;
  description: string;
  studioId: number;
  pcrRoomId: number | null;
  start: Date;
  end: Date;
  type: BookingType;
  templateId: number;
  status: BookingStatus;
  severity: BookingSeverity;
  notifyList: string[];
  color: string;
  studioIds: number[];
}

// Calendar event data
export interface CalendarEventData {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resourceId?: number;
  color?: string;
  textColor?: string;
  borderColor?: string;
  bookingType: BookingType;
  severity: BookingSeverity;
  studioId?: number;
  studioIds: number[];
}

// Booking occurrence data (for recurring bookings)
export interface BookingOccurrence {
  id: number;
  date: string;
  bookingId: number;
  status: BookingStatus;
}

// Booking search/filter parameters
export interface BookingSearchParams {
  startDate?: string;
  endDate?: string;
  studioId?: number;
  pcrRoomId?: number;
  userId?: number;
  type?: BookingType;
  status?: BookingStatus;
  severity?: BookingSeverity;
  q?: string; // Search query
}