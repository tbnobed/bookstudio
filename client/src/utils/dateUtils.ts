/**
 * Date and time utilities for formatting and manipulating dates in the application
 */

/**
 * Format a date object or string to YYYY-MM-DD format for form inputs
 * @param date The date to format
 * @returns Formatted date string in YYYY-MM-DD format
 */
export function formatDateForForm(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Get the components and pad with leading zeros where needed
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0'); // getMonth() is zero-based
  const day = String(d.getDate()).padStart(2, '0');
  
  // Return in YYYY-MM-DD format
  return `${year}-${month}-${day}`;
}

/**
 * Format a date object or string to HH:MM format for time inputs
 * @param date The date to format
 * @returns Formatted time string in HH:MM format
 */
export function formatTimeForForm(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Get the components and pad with leading zeros where needed
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  // Return in HH:MM format
  return `${hours}:${minutes}`;
}

/**
 * Combines a date string and time string into a full JavaScript Date object
 * @param dateStr Date string in YYYY-MM-DD format
 * @param timeStr Time string in HH:MM format
 * @returns A JavaScript Date object with the combined date and time
 */
export function combineDateAndTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // Month is 0-indexed in JavaScript Date
  return new Date(year, month - 1, day, hours, minutes);
}

/**
 * Check if two dates are on the same day (ignoring time)
 * @param date1 First date to compare
 * @param date2 Second date to compare
 * @returns True if the dates are on the same day, false otherwise
 */
export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  
  console.log(`isSameDay: Comparing "${d1.toISOString()}" (${d1.getMonth() + 1}/${d1.getDate()}/${d1.getFullYear()}) with "${d2.toISOString()}" (${d2.getMonth() + 1}/${d2.getDate()}/${d2.getFullYear()}) => ${
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  }`);
  
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Format a date object or string to a human-readable date
 * @param date The date to format
 * @returns Formatted date string like "May 12, 2023"
 */
export function formatDateReadable(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format a date object or string to a human-readable time
 * @param date The date to format
 * @returns Formatted time string like "2:30 PM"
 */
export function formatTimeReadable(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format a date range for display in the UI
 * @param start Start date
 * @param end End date
 * @returns Formatted string like "May 12, 2:30 PM - 4:00 PM" or "May 12 - May 13, 2023"
 */
export function formatDateRange(start: Date | string, end: Date | string): string {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  
  if (isSameDay(startDate, endDate)) {
    // Same day format: "May 12, 2:30 PM - 4:00 PM"
    return `${formatDateReadable(startDate)}, ${formatTimeReadable(startDate)} - ${formatTimeReadable(endDate)}`;
  } else {
    // Different days format: "May 12, 2:30 PM - May 13, 4:00 PM"
    return `${formatDateReadable(startDate)}, ${formatTimeReadable(startDate)} - ${formatDateReadable(endDate)}, ${formatTimeReadable(endDate)}`;
  }
}

/**
 * Add days to a date
 * @param date The starting date
 * @param days Number of days to add (can be negative)
 * @returns A new date with the days added
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get the start of the week (Sunday) for a given date
 * @param date The date to get the week start for
 * @returns Date object for the start of the week
 */
export function getStartOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay(); // 0 = Sunday, 1 = Monday, etc.
  result.setDate(result.getDate() - day); // Go back to Sunday
  result.setHours(0, 0, 0, 0); // Set to beginning of day
  return result;
}

/**
 * Get the end of the week (Saturday) for a given date
 * @param date The date to get the week end for
 * @returns Date object for the end of the week
 */
export function getEndOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay(); // 0 = Sunday, 1 = Monday, etc.
  result.setDate(result.getDate() + (6 - day)); // Go forward to Saturday
  result.setHours(23, 59, 59, 999); // Set to end of day
  return result;
}

/**
 * Returns date formatted in the America/Chicago timezone
 * This is used to fix timezone issues with bookings
 * @param date The date to format
 * @returns Date string formatted in America/Chicago timezone
 */
export function formatChicagoDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Format to Chicago timezone
  return d.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}