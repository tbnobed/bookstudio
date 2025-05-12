import { format, parseISO } from 'date-fns';

/**
 * Format a date for display in a form input with type="date"
 * @param date Date to format
 * @returns Formatted date string in YYYY-MM-DD format
 */
export function formatDateForForm(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'yyyy-MM-dd');
}

/**
 * Format a time for display in a form input with type="time"
 * @param date Date to format
 * @returns Formatted time string in HH:mm format
 */
export function formatTimeForForm(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'HH:mm');
}

/**
 * Format a date and time for display in a form input with type="datetime-local"
 * @param date Date to format
 * @returns Formatted datetime string in YYYY-MM-DDTHH:mm format
 */
export function formatDateTimeForForm(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Convert a date string to a Date object, handling timezone issues
 * @param dateStr Date string to parse
 * @returns Date object
 */
export function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

/**
 * Format a date for display to users in a friendly format
 * @param date Date to format
 * @returns Formatted date string
 */
export function formatDateForDisplay(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'MMM d, yyyy');
}

/**
 * Format a time for display to users in a friendly format
 * @param date Date to format
 * @returns Formatted time string
 */
export function formatTimeForDisplay(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'h:mm a');
}

/**
 * Format a date and time for display to users in a friendly format
 * @param date Date to format
 * @returns Formatted datetime string
 */
export function formatDateTimeForDisplay(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'MMM d, yyyy h:mm a');
}

/**
 * Calculate the duration between two dates in hours and minutes
 * @param start Start date
 * @param end End date
 * @returns Formatted duration string (e.g. "2h 30m")
 */
export function formatDuration(start: Date | string, end: Date | string): string {
  const startDate = typeof start === 'string' ? parseISO(start) : start;
  const endDate = typeof end === 'string' ? parseISO(end) : end;
  
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours === 0) {
    return `${diffMinutes}m`;
  } else if (diffMinutes === 0) {
    return `${diffHours}h`;
  } else {
    return `${diffHours}h ${diffMinutes}m`;
  }
}

/**
 * Add days to a date
 * @param date Base date
 * @param days Number of days to add
 * @returns New date with days added
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add hours to a date
 * @param date Base date
 * @param hours Number of hours to add
 * @returns New date with hours added
 */
export function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

/**
 * Check if two dates are on the same day
 * @param date1 First date
 * @param date2 Second date
 * @returns True if dates are on the same day
 */
export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const day1 = typeof date1 === 'string' ? parseISO(date1) : date1;
  const day2 = typeof date2 === 'string' ? parseISO(date2) : date2;
  
  return (
    day1.getFullYear() === day2.getFullYear() &&
    day1.getMonth() === day2.getMonth() &&
    day1.getDate() === day2.getDate()
  );
}