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
  const d = date instanceof Date ? date : new Date(date);
  
  // Format the date in Chicago timezone
  const chicagoDate = new Date(d.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  
  // Format as YYYY-MM-DD
  const year = chicagoDate.getFullYear();
  const month = String(chicagoDate.getMonth() + 1).padStart(2, '0');
  const day = String(chicagoDate.getDate()).padStart(2, '0');
  
  console.log(`formatDateForForm: Input date: ${date}, Chicago date: ${chicagoDate}, formatted as: ${year}-${month}-${day}`);
  
  return `${year}-${month}-${day}`;
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