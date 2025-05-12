/**
 * Type definitions for PCR (Production Control Rooms)
 */

/**
 * PCR room status types
 */
export type PcrRoomStatus = 'available' | 'in-use' | 'maintenance' | 'down';

/**
 * PCR room type as returned from the API
 */
export interface ApiPcrRoom {
  id: number;
  name: string;
  description: string;
  status: PcrRoomStatus;
}