/**
 * Utility functions for date handling
 */

/**
 * Format a date to a string in the format YYYY-MM-DD for use in form inputs
 * @param date Date object or string
 * @returns Formatted date string in YYYY-MM-DD format
 */
export function formatDateForForm(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Format a date to a string in the format HH:MM for use in form inputs
 * @param date Date object or string
 * @returns Formatted time string in HH:MM format
 */
export function formatTimeForForm(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toTimeString().slice(0, 5);
}

/**
 * Check if two dates are on the same day
 * @param date1 First date
 * @param date2 Second date
 * @returns True if dates are on the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Format a date for display in America/Chicago timezone
 * @param date Date to format
 * @returns Formatted date string
 */
export function formatDateForDisplay(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  
  // Format with Chicago timezone
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Chicago',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  };
  
  return new Intl.DateTimeFormat('en-US', options).format(d);
}

/**
 * Format a time for display in America/Chicago timezone
 * @param date Date to format
 * @returns Formatted time string (just time component)
 */
export function formatTimeForDisplay(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  
  // Format with Chicago timezone (time only)
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  };
  
  return new Intl.DateTimeFormat('en-US', options).format(d);
}

/**
 * Get date range string (e.g., "May 5 - May 6" or "May 5" if same day)
 * @param start Start date
 * @param end End date
 * @returns Formatted date range string
 */
export function getDateRangeString(start: Date, end: Date): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric'
  };
  
  const startStr = new Intl.DateTimeFormat('en-US', options).format(startDate);
  
  if (isSameDay(startDate, endDate)) {
    return startStr;
  }
  
  const endStr = new Intl.DateTimeFormat('en-US', options).format(endDate);
  return `${startStr} - ${endStr}`;
}

/**
 * Get time range string in Chicago timezone (e.g., "5:00 AM - 6:00 PM")
 * @param start Start date
 * @param end End date
 * @returns Formatted time range string
 */
export function getTimeRangeString(start: Date, end: Date): string {
  const timeOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  };
  
  const startStr = new Intl.DateTimeFormat('en-US', timeOptions).format(start);
  const endStr = new Intl.DateTimeFormat('en-US', timeOptions).format(end);
  
  return `${startStr} - ${endStr}`;
}