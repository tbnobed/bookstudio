/**
 * Type definitions for studios
 */

/**
 * Studio status types
 */
export type StudioStatus = 'available' | 'in-use' | 'maintenance' | 'down';

/**
 * Studio type as returned from the API
 */
export interface ApiStudio {
  id: number;
  name: string;
  description: string;
  status: StudioStatus;
}