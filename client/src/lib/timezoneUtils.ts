// This file provides utility functions for working with dates throughout the application
// The application now uses UTC exclusively for all date operations

/**
 * Format a date using UTC
 * @param date The date to format
 * @param options Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatTimeWithTimezone(date: Date | string, options: Intl.DateTimeFormatOptions = {}): string {
  const d = typeof date === "string" ? new Date(date) : date;
  
  return new Intl.DateTimeFormat('en-US', {
    ...options,
    timeZone: 'UTC',
  }).format(d);
}

/**
 * Keep date in UTC - this function now just returns the original date
 * to maintain backward compatibility
 * @param date Date in UTC
 * @returns The same date in UTC (no conversion)
 */
export function dateInTimezone(date: Date): Date {
  return date;
}