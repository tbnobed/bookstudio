/**
 * Date utility functions for BookStud.io
 */

/**
 * Format a date for use in form fields
 * @param date The date to format
 * @returns A string in YYYY-MM-DD format
 */
export function formatDateForForm(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format a time for use in form fields
 * @param date The date to format
 * @returns A string in HH:MM format
 */
export function formatTimeForForm(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Parse a date and time string into a Date object
 * @param dateStr The date string in YYYY-MM-DD format
 * @param timeStr The time string in HH:MM format
 * @returns A Date object
 */
export function parseDateAndTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  return new Date(year, month - 1, day, hours, minutes);
}

/**
 * Format a date for display in America/Chicago timezone
 * @param date The date to format
 * @returns A formatted date string
 */
export function formatDateChicago(date: Date): string {
  return date.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  });
}

/**
 * Check if two dates represent the same day
 * @param date1 First date
 * @param date2 Second date
 * @returns True if both dates are on the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Add days to a date
 * @param date The original date
 * @param days Number of days to add
 * @returns A new Date with days added
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Format date for API parameters
 * @param date The date to format
 * @returns A properly formatted date string for API calls
 */
export function formatDateParam(date: Date): string {
  return date.toISOString();
}