/**
 * Utility functions for date handling
 */

/**
 * Format a date to a string in the format YYYY-MM-DD for use in form inputs
 * Correctly handles the America/Chicago timezone
 * @param date Date object or string
 * @returns Formatted date string in YYYY-MM-DD format
 */
export function formatDateForForm(date: Date | string): string {
  // For bookings with early times, we want to preserve the calendar date as seen in the UI
  // Parse ISO date directly to get the correct date component regardless of time
  const d = date instanceof Date ? date : new Date(date);
  const dateString = d.toISOString();
  
  // Extract YYYY-MM-DD directly from the ISO string
  // ISO format: YYYY-MM-DDTHH:mm:ss.sssZ
  const datePart = dateString.split('T')[0];
  
  console.log(`formatDateForForm: Input date: ${dateString}, extracted date part: ${datePart}`);
  
  return datePart;
}

/**
 * Format a date to a string in the format HH:MM for use in form inputs
 * Correctly handles the America/Chicago timezone
 * @param date Date object or string
 * @returns Formatted time string in HH:MM format
 */
export function formatTimeForForm(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  
  // Format time in Chicago timezone using 24-hour format
  return d.toLocaleTimeString('en-US', { 
    timeZone: 'America/Chicago',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Check if two dates are on the same day in America/Chicago timezone
 * @param date1 First date
 * @param date2 Second date
 * @returns True if dates are on the same day in Chicago timezone
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  // Convert dates to Chicago timezone strings
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  };
  
  const chicagoDate1 = new Date(date1).toLocaleString('en-US', options);
  const chicagoDate2 = new Date(date2).toLocaleString('en-US', options);
  
  // Log the comparison for debugging
  console.log(`isSameDay: Comparing "${date1.toISOString()}" (${chicagoDate1}) with "${date2.toISOString()}" (${chicagoDate2}) => ${chicagoDate1 === chicagoDate2}`);
  
  // If the formatted dates (without time) match, they're the same day in Chicago timezone
  return chicagoDate1 === chicagoDate2;
}

/**
 * Get the start and end of day in Chicago timezone for a given date
 * This returns UTC date objects that represent midnight to midnight in Chicago
 * @param date The date to get day range for
 * @returns Object with start and end properties representing midnight to midnight in Chicago timezone
 */
export function getDayRangeInChicago(date: Date): { start: Date, end: Date } {
  // Format the date in Chicago timezone to get year, month, day components
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  };
  
  const chicagoDateStr = date.toLocaleString('en-US', options);
  const [monthDayYear, _] = chicagoDateStr.split(',');
  const [month, day, year] = monthDayYear.split('/').map(Number);
  
  // Create a date object representing midnight at the start of the day in Chicago
  const chicagoMidnight = new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0)); // 00:00 in Chicago is 05:00 in UTC
  
  // Create end of day (23:59:59.999)
  const chicagoEndOfDay = new Date(Date.UTC(year, month - 1, day, 29, 59, 59, 999)); // 23:59:59.999 in Chicago
  
  console.log(`getDayRangeInChicago: For date ${date.toISOString()} (${chicagoDateStr}), range is: ${chicagoMidnight.toISOString()} to ${chicagoEndOfDay.toISOString()}`);
  
  return { start: chicagoMidnight, end: chicagoEndOfDay };
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