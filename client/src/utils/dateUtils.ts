/**
 * Date utility functions for the BookStud.io application
 * Handles date/time formatting with timezone awareness
 */

// Format a date for display in the UI
export function formatDate(date: Date | string): string {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Format: May 5, 2025
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Chicago'
  });
}

// Format a time for display in the UI
export function formatTime(date: Date | string): string {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Format: 9:30 AM
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Chicago'
  });
}

// Format a date and time together for display
export function formatDateTime(date: Date | string): string {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Format: May 5, 2025 9:30 AM
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Chicago'
  });
}

// Format date for form inputs (YYYY-MM-DD)
export function formatDateForForm(date: Date | string): string {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Use ISO string to get YYYY-MM-DD format but adjust for timezone
  // This ensures we're getting the correct day in the America/Chicago timezone
  const year = d.toLocaleString('en-US', { year: 'numeric', timeZone: 'America/Chicago' });
  const month = d.toLocaleString('en-US', { month: '2-digit', timeZone: 'America/Chicago' }).padStart(2, '0');
  const day = d.toLocaleString('en-US', { day: '2-digit', timeZone: 'America/Chicago' }).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

// Format time for form inputs (HH:MM)
export function formatTimeForForm(date: Date | string): string {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Get hours and minutes in America/Chicago timezone
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Chicago'
  });
  
  return timeStr;
}

// Calculate duration between two dates in hours and minutes
export function formatDuration(start: Date | string, end: Date | string): string {
  if (!start || !end) return '';
  
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  
  // Calculate duration in milliseconds
  const durationMs = endDate.getTime() - startDate.getTime();
  
  // Convert to hours and minutes
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours === 0) {
    return `${minutes}m`;
  } else if (minutes === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${minutes}m`;
  }
}

// Check if two date ranges overlap
export function datesOverlap(
  start1: Date | string,
  end1: Date | string,
  start2: Date | string,
  end2: Date | string
): boolean {
  const s1 = typeof start1 === 'string' ? new Date(start1) : start1;
  const e1 = typeof end1 === 'string' ? new Date(end1) : end1;
  const s2 = typeof start2 === 'string' ? new Date(start2) : start2;
  const e2 = typeof end2 === 'string' ? new Date(end2) : end2;
  
  return s1 < e2 && s2 < e1;
}

// Get start of day (midnight) for a given date in America/Chicago timezone
export function getStartOfDay(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  
  // Format the date in Chicago timezone as YYYY-MM-DD
  const dateStr = formatDateForForm(d);
  
  // Create a new date with time set to 00:00:00 in Chicago timezone
  return new Date(`${dateStr}T00:00:00-05:00`);
}

// Get end of day (23:59:59.999) for a given date in America/Chicago timezone
export function getEndOfDay(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  
  // Format the date in Chicago timezone as YYYY-MM-DD
  const dateStr = formatDateForForm(d);
  
  // Create a new date with time set to 23:59:59.999 in Chicago timezone
  return new Date(`${dateStr}T23:59:59.999-05:00`);
}

// Convert a date to America/Chicago timezone ISO string
export function toChicagoISOString(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Get the date components in Chicago timezone
  const year = d.toLocaleString('en-US', { year: 'numeric', timeZone: 'America/Chicago' });
  const month = d.toLocaleString('en-US', { month: '2-digit', timeZone: 'America/Chicago' }).padStart(2, '0');
  const day = d.toLocaleString('en-US', { day: '2-digit', timeZone: 'America/Chicago' }).padStart(2, '0');
  const hour = d.toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone: 'America/Chicago' }).padStart(2, '0');
  const minute = d.toLocaleString('en-US', { minute: '2-digit', timeZone: 'America/Chicago' }).padStart(2, '0');
  const second = d.toLocaleString('en-US', { second: '2-digit', timeZone: 'America/Chicago' }).padStart(2, '0');
  
  // Construct ISO string in Chicago timezone
  return `${year}-${month}-${day}T${hour}:${minute}:${second}-05:00`;
}