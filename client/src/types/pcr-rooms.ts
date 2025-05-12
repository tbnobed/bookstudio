/**
 * Type definitions for PCR rooms (Production Control Rooms)
 */

/**
 * PCR Room as returned from the API
 */
export interface ApiPcrRoom {
  id: number;
  name: string;
  description: string | null;
  status: 'available' | 'unavailable' | 'maintenance';
}

/**
 * Form data for creating/editing a PCR room
 */
export interface PcrRoomFormData {
  id?: number;
  name: string;
  description: string;
  status: 'available' | 'unavailable' | 'maintenance';
}

/**
 * PCR Room creation/update payload
 */
export interface PcrRoomPayload {
  name: string;
  description: string;
  status: 'available' | 'unavailable' | 'maintenance';
}