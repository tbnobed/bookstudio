/**
 * Type definitions for booking templates in BookStud.io
 */

// API Template data
export interface ApiTemplate {
  id: number;
  name: string;
  description: string | null;
  type: string;
  duration: number;
  studioIds: number[];
  pcrRoomId: number | null;
  status: string;
  severity: string;
  color: string | null;
  notifyList: string[];
  createdAt?: string;
  userId?: number;
}

// Template form data
export interface TemplateFormData {
  id?: number;
  name: string;
  description: string;
  type: string;
  duration: number;
  studioIds: number[];
  pcrRoomId: number | null;
  status: string;
  severity: string;
  color: string;
  notifyList: string[];
}