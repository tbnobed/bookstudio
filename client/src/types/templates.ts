/**
 * Type definitions for templates
 */
import { BookingType, BookingStatus, BookingSeverity } from './bookings';
import { Json } from './common';

/**
 * Template type as returned from the API
 */
export interface ApiTemplate {
  id: number;
  name: string;
  description: string;
  type: string;
  duration: number;
  crewRequired: string[] | null;  // Array of email addresses or notification group IDs
  equipment: any | null;          // JSON field that can store additional data like studioIds, etc.
  createdBy: number;

  // The following properties may be stored in the equipment JSON field
  // We'll access them through our template handlers
  studioIds?: number[];          // May be stored in equipment.studioIds
  pcrRoomId?: number | null;     // May be stored in equipment.pcrRoomId
  status?: BookingStatus;        // May be stored in equipment.status
  severity?: BookingSeverity;    // May be stored in equipment.severity
  color?: string;                // May be stored in equipment.color
  notifyList?: string[];         // May be identical to crewRequired
}

/**
 * Form data for creating/editing a template
 */
export interface TemplateFormData {
  id?: number;
  name: string;
  description: string;
  type: BookingType;
  duration: number;
  studioIds: number[];
  pcrRoomId: number | null;
  crewRequired: string[];
  equipment: any;
  status?: BookingStatus;
  severity?: BookingSeverity;
  color?: string;
}