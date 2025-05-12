// Studio type definitions for the BookStud.io application

// Studio data structure from API
export interface Studio {
  id: number;
  name: string;
  description: string;
  status?: 'available' | 'maintenance' | 'booked' | 'off-air';
  color?: string;
}

// Used for studio filtering in the UI
export interface StudioFilterOption {
  id: number;
  name: string;
  selected: boolean;
}