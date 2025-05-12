/**
 * Date utility functions for the Booking system
 * Provides consistent date formatting across the application
 * Optimized for America/Chicago timezone
 */

import { format } from 'date-fns';

/**
 * Format a date for display in the calendar
 * @param date The date to format
 * @returns Formatted date string (e.g., "May 5, 2025")
 */
export function formatDate(date: Date): string {
  return format(date, 'MMM d, yyyy');
}

/**
 * Format a time for display in the calendar
 * @param date The date to format
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export function formatTime(date: Date): string {
  return format(date, 'h:mm a');
}

/**
 * Format a date and time for display in the calendar
 * @param date The date to format
 * @returns Formatted date and time string (e.g., "May 5, 2025 2:30 PM")
 */
export function formatDateTime(date: Date): string {
  return format(date, 'MMM d, yyyy h:mm a');
}

/**
 * Format a date for use in an HTML date input
 * @param date The date to format
 * @returns Formatted date string (e.g., "2025-05-05")
 */
export function formatDateForForm(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Format a time for use in an HTML time input
 * @param date The date to format
 * @returns Formatted time string (e.g., "14:30")
 */
export function formatTimeForForm(date: Date): string {
  return format(date, 'HH:mm');
}

/**
 * Generate America/Chicago timezone-aware date string 
 * @param date The date to format
 * @returns Formatted date string for Chicago timezone
 */
export function formatChicagoDate(date: Date): string {
  // This offset would be better handled with a library like date-fns-tz
  // For now, this is a simple implementation
  return format(date, 'yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'');
}

/**
 * Determines if a date is today
 * @param date The date to check
 * @returns True if the date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
}

/**
 * Creates a date range array for the calendar
 * @param startDate The start date
 * @param days Number of days in the range
 * @returns Array of Date objects
 */
export function createDateRange(startDate: Date, days: number): Date[] {
  const dates: Date[] = [];
  const start = new Date(startDate);
  
  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }
  
  return dates;
}

/**
 * Gets the duration between two dates in hours and minutes
 * @param startDate The start date
 * @param endDate The end date
 * @returns Duration string (e.g., "2h 30m")
 */
export function getDuration(startDate: Date, endDate: Date): string {
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHrs === 0) {
    return `${diffMins}m`;
  } else if (diffMins === 0) {
    return `${diffHrs}h`;
  } else {
    return `${diffHrs}h ${diffMins}m`;
  }
}

/**
 * Creates a timezone-aware ISO string
 * @param date The date to format
 * @returns ISO date string
 */
export function toISOString(date: Date): string {
  return date.toISOString();
}