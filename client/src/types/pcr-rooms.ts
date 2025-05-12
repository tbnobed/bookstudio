/**
 * Type definitions for Production Control Rooms (PCR)
 */

// PCR room status
export type PcrRoomStatus = 'available' | 'maintenance' | 'offline';

// PCR room data
export interface PcrRoom {
  id: number;
  name: string;
  description: string | null;
  status: PcrRoomStatus;
  equipment: string[] | null;
  capacity: number | null;
}

// PCR room with associated bookings
export interface PcrRoomWithBookings extends PcrRoom {
  bookings: number[];
}

// PCR room creation/edit form data
export interface PcrRoomFormData {
  id?: number;
  name: string;
  description: string;
  status: PcrRoomStatus;
  equipment: string[];
  capacity: number;
}