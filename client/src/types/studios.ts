/**
 * Type definitions for TV studios
 */

// Studio status
export type StudioStatus = 'available' | 'maintenance' | 'offline';

// Studio data
export interface Studio {
  id: number;
  name: string;
  description: string | null;
  status: StudioStatus;
  location: string | null;
  capacity: number | null;
  equipment: string[] | null;
  image: string | null;
  color: string | null;
}

// Studio with booking data
export interface StudioWithBookings extends Studio {
  bookings: number[];
}

// Studio creation/edit form data
export interface StudioFormData {
  id?: number;
  name: string;
  description: string;
  status: StudioStatus;
  location: string;
  capacity: number;
  equipment: string[];
  image: string | null;
  color: string;
}