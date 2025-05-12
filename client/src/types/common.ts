/**
 * Common utility types
 */

/**
 * Generic JSON type
 */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/**
 * Error response from API
 */
export interface ApiError {
  message: string;
  errors?: any[];
}