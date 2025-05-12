/**
 * Type definitions for booking templates
 */

import { BookingType, BookingSeverity, BookingStatus } from './bookings';

// Template data
export interface Template {
  id: number;
  name: string;
  description: string | null;
  type: BookingType;
  defaultDuration: number | null;
  status: BookingStatus;
  severity: BookingSeverity;
  studioIds: number[] | null;
  pcrRoomId: number | null;
  color: string | null;
  equipment: string[] | null;
  notifyList: string[] | null;
  createdBy: number;
  createdAt: string;
}

// Template creation/edit form data
export interface TemplateFormData {
  id?: number;
  name: string;
  description: string;
  type: BookingType;
  defaultDuration: number;
  status: BookingStatus;
  severity: BookingSeverity;
  studioIds: number[];
  pcrRoomId: number | null;
  color: string;
  equipment: string[];
  notifyList: string[];
}

// Template dropdown/display item
export interface TemplateItem {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
}