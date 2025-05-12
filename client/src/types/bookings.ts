/**
 * Type definitions for bookings
 */

// Booking types
export type BookingType = 'production' | 'maintenance' | 'private' | 'alert' | 'other';

// Booking status
export type BookingStatus = 'draft' | 'confirmed' | 'cancelled' | 'completed';

// Booking severity (for alerts/maintenance)
export type BookingSeverity = 'low' | 'medium' | 'high' | 'critical';

// Booking data from API
export interface ApiBooking {
  id: number;
  title: string;
  description: string | null;
  studioId: number | null;
  pcrRoomId: number | null;
  userId: number;
  start: string | Date;
  end: string | Date;
  type: BookingType;
  templateId: number | null;
  status: BookingStatus;
  notifyList: string[];
  color: string;
  severity: BookingSeverity;
}

// Form data for creating/editing a booking
export interface FormBookingData {
  id: number;
  title: string;
  description: string;
  studioId: number;
  pcrRoomId: number;
  start: Date;
  end: Date;
  type: BookingType;
  templateId: number;
  status: BookingStatus;
  notifyList: string[];
  severity: BookingSeverity;
  color: string;
  studioIds?: number[];
}

// API response from booking creation
export interface BookingResponse {
  success: boolean;
  booking?: ApiBooking;
  error?: string;
}

// Booking with studios data
export interface BookingWithStudios extends ApiBooking {
  studios: number[];
}

// Calendar day cell data
export interface CalendarDayData {
  date: Date;
  bookings: ApiBooking[];
  isToday: boolean;
  isInCurrentMonth: boolean;
}

// Calendar day with processed bookings
export interface ProcessedCalendarDay {
  date: Date;
  bookingsByStudio: Record<number, ApiBooking[]>;
  isToday: boolean;
  isInCurrentMonth: boolean;
}