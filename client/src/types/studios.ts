/**
 * Type definitions for studios in the BookStud.io system
 */

// Studio status types
export type StudioStatus = 'available' | 'maintenance' | 'offline';

// Complete studio data
export interface Studio {
  id: number;
  name: string;
  description: string | null;
  location: string | null;
  equipment: string[] | null;
  capacity: number | null;
  status: StudioStatus;
  maintenanceNotes: string | null;
  lastMaintenanceDate: string | null;
}

// Studio creation/edit form data
export interface StudioFormData {
  id?: number;
  name: string;
  description: string;
  location: string;
  equipment: string[];
  capacity: number;
  status: StudioStatus;
  maintenanceNotes: string;
}

// Studio with linked bookings
export interface StudioWithBookings extends Studio {
  bookings: number[];
}

// Studio dropdown/display item
export interface StudioItem {
  id: number;
  name: string;
  status: StudioStatus;
}