// Booking template type definitions

import { BookingType } from './bookings';

// Data structure from API for booking templates
export interface Template {
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

// Form data structure for template creation/editing
export interface TemplateFormData {
  id?: number;
  name: string;
  description: string;
  duration: number;
  type: BookingType;
  pcrRoomId: number;
  color: string;
  studioIds: number[];
}