// PCR (Production Control Room) type definitions

// PCR Room data structure from API
export interface PcrRoom {
  id: number;
  name: string;
  description: string;
  status?: 'available' | 'maintenance' | 'booked' | 'off-air';
  capacity?: number;
}