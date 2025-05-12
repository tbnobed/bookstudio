/**
 * Type definitions for PCR (Production Control Room) rooms in BookStud.io
 */

// PCR room status types
export type PcrRoomStatus = 'available' | 'maintenance' | 'reserved';

// API PCR Room data
export interface ApiPcrRoom {
  id: number;
  name: string;
  description: string | null;
  status: PcrRoomStatus;
  features?: string[] | null;
  createdAt?: string;
}

// PCR Room form data
export interface PcrRoomFormData {
  id?: number;
  name: string;
  description: string;
  status: PcrRoomStatus;
  features: string[];
}