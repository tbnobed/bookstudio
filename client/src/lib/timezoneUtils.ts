// This file provides utility functions for working with timezones across the application

// Default timezone to use when no selection is available
export const DEFAULT_TIMEZONE = 'America/New_York';

/**
 * Get the currently set timezone from localStorage or default
 * This allows non-React code to access the timezone value
 */
export function getTimezone(): string {
  // Try to get the timezone from localStorage
  const savedTimezone = localStorage.getItem('bookstudio-timezone');
  
  // Return the saved timezone or default to America/New_York
  return savedTimezone || DEFAULT_TIMEZONE;
}

/**
 * Format a date using the application timezone
 * @param date The date to format
 * @param options Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatTimeWithTimezone(date: Date | string, options: Intl.DateTimeFormatOptions = {}): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const timezone = getTimezone();
  
  return new Intl.DateTimeFormat('en-US', {
    ...options,
    timeZone: timezone,
  }).format(d);
}

/**
 * Convert a UTC date to the selected timezone
 * @param date Date in UTC
 * @returns Date adjusted to the current timezone
 */
export function dateInTimezone(date: Date): Date {
  const timezone = getTimezone();
  
  // Create a formatter that includes all time parts
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  
  // Format the date in the target timezone
  const parts = formatter.formatToParts(date);
  
  // Extract date components
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1; // month is 0-indexed
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0');
  
  // Create a new date with the adjusted values
  return new Date(year, month, day, hour, minute, second);
}