// Booking type definitions for the BookStud.io application

// Studio booking types
export type BookingType = 'production' | 'maintenance' | 'private' | 'alert' | 'other';

// Booking status values
export type BookingStatus = 'draft' | 'confirmed' | 'cancelled';

// Booking severity levels for maintenance and alerts
export type BookingSeverity = 'low' | 'medium' | 'high' | 'critical';

// Data structure for bookings fetched from API
export interface ApiBooking {
  // Core properties
  id: number;
  title: string;
  description: string;
  studioId: number;
  pcrRoomId: number; 
  userId: number;
  
  // Timing
  start: string; 
  end: string;
  
  // Classification
  type: BookingType;
  status: BookingStatus;
  severity: BookingSeverity;
  
  // Additional metadata
  templateId: number;
  notifyList: string[];
  color: string;
  
  // Optional - studios linked to this booking (for multi-studio bookings)
  studios?: {
    id: number;
    name: string;
  }[];
}

// Form data structure used in booking forms
export interface FormBookingData {
  // Core properties
  id: number;
  title: string;
  description: string;
  studioId: number;
  pcrRoomId: number;
  
  // Timing - using Date objects for easier form handling
  start: Date;
  end: Date;
  
  // Classification
  type: BookingType;
  status: BookingStatus;
  severity: BookingSeverity;
  
  // Additional metadata
  templateId: number;
  notifyList: string[];
  color: string;
}

// Data structure for creating a new booking
export interface CreateBookingRequest {
  title: string;
  description: string;
  studioId: number;
  pcrRoomId: number;
  type: BookingType;
  start: Date;
  end: Date;
  templateId: number;
  status: BookingStatus;
  severity: BookingSeverity;
  color: string;
  studioIds: number[]; // Array of studio IDs for multi-studio bookings
}

// Data structure for updating an existing booking
export interface UpdateBookingRequest {
  id: number;
  data: Partial<{
    title: string;
    description: string;
    studioId: number;
    pcrRoomId: number;
    type: string;
    start: Date;
    end: Date;
    userId: number;
    templateId: number;
    status: string;
    notifyList: string[];
    severity: string;
    color: string;
  }>;
  studioIds?: number[]; // Array of studio IDs for multi-studio bookings
}

// Data structure for booking templates
export interface BookingTemplate {
  id: number;
  name: string;
  description: string;
  duration: number; // Duration in minutes
  type: BookingType;
  pcrRoomId: number;
  userId: number;
  color: string;
  studioIds: number[];
}

// Response from booking-studios endpoint
export interface BookingStudioLink {
  id: number;
  bookingId: number;
  studioId: number;
}