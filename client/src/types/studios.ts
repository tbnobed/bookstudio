/**
 * Type definitions for studios
 */

/**
 * Studio as returned from the API
 */
export interface ApiStudio {
  id: number;
  name: string;
  description: string | null;
  status: 'available' | 'unavailable' | 'maintenance';
  type: string | null;
  location: string | null;
  capacity: number | null;
}

/**
 * Form data for creating/editing a studio
 */
export interface StudioFormData {
  id?: number;
  name: string;
  description: string;
  status: 'available' | 'unavailable' | 'maintenance';
  type: string;
  location: string;
  capacity: number;
}

/**
 * Studio creation/update payload
 */
export interface StudioPayload {
  name: string;
  description: string;
  status: 'available' | 'unavailable' | 'maintenance';
  type: string;
  location: string;
  capacity: number;
}