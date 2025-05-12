/**
 * Type definitions for studios in BookStud.io
 */

// Studio status types
export type StudioStatus = 'available' | 'maintenance' | 'reserved';

// API Studio data
export interface ApiStudio {
  id: number;
  name: string;
  description: string | null;
  status: StudioStatus;
  features: string[] | null;
  location: string | null;
  createdAt?: string;
}

// Studio form data
export interface StudioFormData {
  id?: number;
  name: string;
  description: string;
  status: StudioStatus;
  features: string[];
  location: string;
}