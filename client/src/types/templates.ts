/**
 * Type definitions for templates
 */

import { Json } from './common';

/**
 * Template as returned from the API
 */
export interface ApiTemplate {
  id: number;
  name: string;
  description: string | null;
  type: string;
  duration: number;
  crewRequired: number[] | null;
  equipment: TemplateEquipment[] | TemplateEquipment | null;
  createdBy: number;
}

/**
 * Template equipment data structure
 */
export interface TemplateEquipment {
  studioIds?: number[];
  pcrRoomId?: number | null;
  status?: string;
  severity?: string;
  color?: string;
  [key: string]: any;
}

/**
 * Form data for creating/editing a template
 */
export interface TemplateFormData {
  id?: number;
  name: string;
  description: string;
  type: string;
  duration: number;
  crewRequired: number[];
  equipment: TemplateEquipment[];
}

/**
 * Template creation/update payload
 */
export interface TemplatePayload {
  name: string;
  description: string;
  type: string;
  duration: number;
  crewRequired: number[];
  equipment: Json;
}