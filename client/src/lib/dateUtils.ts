/**
 * Date utilities for BookStud.io
 * 
 * This file provides all date and time formatting functions for the application.
 * A key requirement is that ALL date/time displays must be shown in the facility timezone
 * (America/Chicago - Dallas, TX) regardless of the user's local timezone. This ensures
 * that a booking for 8am-10am appears as 8am-10am for everyone using the application.
 */

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const SHORT_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

// The facility timezone is America/Chicago (Dallas, TX)
export const FACILITY_TIMEZONE = 'America/Chicago';

/**
 * Creates a Date object for a specific date/time in the facility timezone
 * This is used for creating Date objects that represent a specific local time
 * in the facility timezone, regardless of the user's local timezone.
 * 
 * @param year Year
 * @param month Month (0-11)
 * @param day Day of month
 * @param hour Hour (0-23)
 * @param minute Minute
 * @param second Second
 * @returns Date object representing the specified time in facility timezone
 */
export function createFacilityDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): Date {
  // Create a date string in ISO format with the Chicago timezone
  const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
  
  // Use the date constructor with explicit timezone (-05:00 is Central Time/America/Chicago)
  return new Date(`${dateString}-05:00`);
}

/**
 * Format a date for form inputs in the facility timezone
 * 
 * @param date The date to format
 * @returns Date string in YYYY-MM-DD format in facility timezone
 */
export function formatDateForForm(date: Date): string {
  // Get the date components in the facility timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: FACILITY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(date);
  const month = parts.find(part => part.type === 'month')?.value || '01';
  const day = parts.find(part => part.type === 'day')?.value || '01';
  const year = parts.find(part => part.type === 'year')?.value || '2025';
  
  console.log(`formatDateForForm: Input date: ${date.toISOString()}, formatted as: ${year}-${month}-${day}`);
  
  return `${year}-${month}-${day}`;
}

/**
 * Format a date as a time string in the facility timezone
 * 
 * @param date The date to format
 * @returns Formatted time string (e.g. "8:00 AM")
 */
export function formatTimeInFacilityTimezone(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: FACILITY_TIMEZONE
  });
}

/**
 * Format a date in the facility timezone
 * 
 * @param date The date to format
 * @returns Formatted date string (e.g. "May 5, 2025")
 */
export function formatDateInFacilityTimezone(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: FACILITY_TIMEZONE
  });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  // Use facility timezone for all time formatting
  return formatTimeInFacilityTimezone(d);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  // Use facility timezone for all date formatting
  return formatDateInFacilityTimezone(d);
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { 
    month: "numeric", 
    day: "numeric",
    timeZone: FACILITY_TIMEZONE 
  });
}

export function formatTimeRange(start: Date | string, end: Date | string): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

export function formatDateTimeRange(start: Date | string, end: Date | string): string {
  const startDate = typeof start === "string" ? new Date(start) : start;
  const endDate = typeof end === "string" ? new Date(end) : end;
  
  const sameDay = startDate.toDateString() === endDate.toDateString();
  
  if (sameDay) {
    return `${formatDate(startDate)}, ${formatTime(startDate)} - ${formatTime(endDate)}`;
  } else {
    return `${formatDate(startDate)}, ${formatTime(startDate)} - ${formatDate(endDate)}, ${formatTime(endDate)}`;
  }
}

export function getWeekDates(date: Date | null | undefined): Date[] {
  // Always create a fresh copy of the date to avoid reference issues
  const safeDate = date ? new Date(date.getTime()) : new Date();
  
  // Add timestamp for debugging and tracking
  const timestamp = Date.now();
  console.log(`getWeekDates - [Timestamp: ${timestamp}] Input date: ${safeDate.toISOString()}`);
  
  // Get the day of the week (0-6, where 0 is Sunday)
  const day = safeDate.getDay();
  
  // Calculate the date of Sunday (start of week)
  const diff = safeDate.getDate() - day;
  const weekStart = new Date(safeDate.getTime());
  weekStart.setDate(diff);
  
  console.log(`getWeekDates - [Timestamp: ${timestamp}] Calculated week start: ${weekStart.toISOString()}`);
  
  // Create an array of dates for the week
  const weekDates: Date[] = [];
  
  // Generate 7 days starting from Sunday
  for (let i = 0; i < 7; i++) {
    // Create a fresh date object for each day to avoid reference issues
    const nextDate = new Date(weekStart.getTime());
    nextDate.setDate(weekStart.getDate() + i);
    weekDates.push(nextDate);
  }
  
  console.log(`getWeekDates - [Timestamp: ${timestamp}] First date in array: ${weekDates[0].toISOString()}, Last date: ${weekDates[6].toISOString()}`);
  
  return weekDates;
}

export function getWeekRange(date: Date | null | undefined): { start: Date; end: Date } {
  const weekDates = getWeekDates(date);
  
  // Always create new date objects to avoid reference issues
  return {
    start: new Date(weekDates[0].getTime()),
    end: new Date(weekDates[6].getTime()),
  };
}

export function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  // Get days from previous month to fill the first week
  const daysFromPrevMonth = firstDay.getDay();
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevMonthYear = month === 0 ? year - 1 : year;
  const prevMonthLastDay = new Date(prevMonthYear, prevMonth + 1, 0).getDate();
  
  for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
    days.push(new Date(prevMonthYear, prevMonth, prevMonthLastDay - i));
  }
  
  // Current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }
  
  // Next month days to complete the grid (6 rows x 7 columns = 42 cells)
  const remainingDays = 42 - days.length;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextMonthYear = month === 11 ? year + 1 : year;
  
  for (let i = 1; i <= remainingDays; i++) {
    days.push(new Date(nextMonthYear, nextMonth, i));
  }
  
  return days;
}

/**
 * Checks if two dates represent the same day in the facility timezone
 * This is critical for ensuring bookings appear on the correct day in all timezones
 * 
 * @param date1 First date to compare
 * @param date2 Second date to compare
 * @returns True if the dates represent the same day in facility timezone
 */
export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  // Make defensive copies to ensure we don't modify the inputs
  const d1 = typeof date1 === "string" ? new Date(date1) : new Date(date1.getTime());
  const d2 = typeof date2 === "string" ? new Date(date2) : new Date(date2.getTime());
  
  // Use Intl.DateTimeFormat to get the date components in the facility timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: FACILITY_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
  
  // Get formatted dates in the facility timezone (America/Chicago - Dallas)
  const d1Formatted = formatter.format(d1);
  const d2Formatted = formatter.format(d2);
  
  // Get the actual date components for better debug info
  const d1Parts = formatter.formatToParts(d1);
  const d2Parts = formatter.formatToParts(d2);
  
  // Extract day, month, year for both dates in facility timezone
  const getDatePart = (parts: Intl.DateTimeFormatPart[], type: string) => {
    const part = parts.find(p => p.type === type);
    return part ? part.value : '';
  };
  
  const d1Month = getDatePart(d1Parts, 'month');
  const d1Day = getDatePart(d1Parts, 'day');
  const d1Year = getDatePart(d1Parts, 'year');
  
  const d2Month = getDatePart(d2Parts, 'month');
  const d2Day = getDatePart(d2Parts, 'day');
  const d2Year = getDatePart(d2Parts, 'year');
  
  // Result is true if all date parts match
  const result = d1Formatted === d2Formatted;
  
  // Log detailed comparison for debugging purposes
  const debugDate = new Date(2025, 4, 8); // May 8, 2025
  const diffD1 = Math.abs((d1.getTime() - debugDate.getTime()) / (1000 * 60 * 60 * 24));
  const diffD2 = Math.abs((d2.getTime() - debugDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Only log for dates near our problem period (May 2025)
  if (diffD1 < 30 || diffD2 < 30) {
    console.log(`isSameDay: Comparing "${d1.toISOString()}" (${d1Month}/${d1Day}/${d1Year}) with "${d2.toISOString()}" (${d2Month}/${d2Day}/${d2Year}) => ${result}`);
  }
  
  return result;
}

export function formatWeekRangeText(currentDate: Date | null | undefined): string {
  // If no date is provided, use current date
  // Always create a clean copy of the date to avoid reference issues
  const safeDate = currentDate ? new Date(currentDate.getTime()) : new Date();
  
  // Add timestamp for unique logging
  const timestamp = Date.now();
  console.log(`formatWeekRangeText - [CALLED at ${timestamp}] Date input: ${safeDate.toISOString()}`);
  
  try {
    // Calculate week start (Sunday) and end (Saturday) from scratch
    const dayOfWeek = safeDate.getDay(); // 0-6, 0 is Sunday
    
    // Calculate Sunday (start of week)
    const startDate = new Date(safeDate);
    startDate.setDate(safeDate.getDate() - dayOfWeek);
    
    // Calculate Saturday (end of week)
    const endDate = new Date(safeDate);
    endDate.setDate(safeDate.getDate() - dayOfWeek + 6);
    
    console.log(`formatWeekRangeText - [${timestamp}] Direct calculation - Week start: ${startDate.toISOString()}, end: ${endDate.toISOString()}`);
    
    // Format month names
    const startMonth = MONTH_NAMES[startDate.getMonth()].substring(0, 3);
    const endMonth = MONTH_NAMES[endDate.getMonth()].substring(0, 3);
    
    // Format the week range text
    const result = (startDate.getMonth() === endDate.getMonth()) 
      ? `${startMonth} ${startDate.getDate()} - ${endDate.getDate()}, ${startDate.getFullYear()}`
      : `${startMonth} ${startDate.getDate()} - ${endMonth} ${endDate.getDate()}, ${startDate.getFullYear()}`;
      
    console.log(`formatWeekRangeText - [${timestamp}] Result: ${result}`);
    return result;
  } catch (error) {
    console.error(`formatWeekRangeText - Error: ${error}`);
    
    // Fallback in case of any error
    return safeDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
}

export function createTimeSlots(startHour: number, endHour: number, interval: number): string[] {
  const slots: string[] = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute = 0; minute < 60; minute += interval) {
      const hourFormatted = hour.toString().padStart(2, "0");
      const minuteFormatted = minute.toString().padStart(2, "0");
      slots.push(`${hourFormatted}:${minuteFormatted}`);
    }
  }
  return slots;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function subtractDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

export function subtractWeeks(date: Date, weeks: number): Date {
  return addDays(date, -weeks * 7);
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function subtractMonths(date: Date, months: number): Date {
  return addMonths(date, -months);
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

export function generateTimeOptions(): string[] {
  const timeOptions: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = hour % 12 || 12;
      const period = hour < 12 ? "am" : "pm";
      timeOptions.push(`${h}:${minute.toString().padStart(2, "0")}${period}`);
    }
  }
  return timeOptions;
}

/**
 * Convert a date string and time string to a Date object in the facility timezone
 * 
 * @param dateStr Date string in format "YYYY-MM-DD"
 * @param timeStr Time string in format "h:mmam" or "h:mmpm" (e.g., "1:30pm", "12:00am")
 * @returns Date object representing the date and time in the facility timezone
 */
export function timeToDate(dateStr: string, timeStr: string): Date {
  // Extract hours and minutes from timeStr (format: "1:30pm", "12:00am", etc.)
  const timeParts = timeStr.match(/^(\d+):(\d+)([ap]m)$/i);
  if (!timeParts) throw new Error("Invalid time format");
  
  let [_, hours, minutes, period] = timeParts;
  let hourNum = parseInt(hours);
  const minuteNum = parseInt(minutes);
  
  // Convert to 24-hour format
  if (period.toLowerCase() === "pm" && hourNum < 12) {
    hourNum += 12;
  } else if (period.toLowerCase() === "am" && hourNum === 12) {
    hourNum = 0;
  }
  
  // Parse the date string (format: "YYYY-MM-DD")
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Use our createFacilityDate function with the year, month, day, hour, minute
  // This ensures the date is explicitly created in the facility's timezone
  // Note: month in createFacilityDate is 0-based, but the parsed month from dateStr is 1-based
  const dateObj = createFacilityDate(year, month - 1, day, hourNum, minuteNum);
  
  // Log for debugging
  console.log(`Date selected: ${dateStr}, time: ${timeStr}, parsed as: ${dateObj.toISOString()} (Dallas time)`);
  
  return dateObj;
}

/**
 * Run a quick test of timezone handling to verify our implementation
 * This can be called from the browser console to test the timezone handling
 */
export function testTimezoneHandling(): void {
  console.log("=== TIMEZONE HANDLING TEST ===");
  console.log(`User's local timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  console.log(`Facility timezone: ${FACILITY_TIMEZONE}`);
  
  // Create a test date for Dallas at 8:00 AM
  const testDate = createFacilityDate(2025, 4, 15, 8, 0, 0); // May 15, 2025 8:00 AM in Dallas
  
  console.log(`\nTest date (8:00 AM in Dallas): ${testDate.toISOString()}`);
  console.log(`Formatted with formatTime: ${formatTime(testDate)}`);
  console.log(`Formatted with formatDate: ${formatDate(testDate)}`);
  console.log(`Formatted with formatDateTimeRange: ${formatDateTimeRange(testDate, new Date(testDate.getTime() + 3600000))}`);
  
  // Test date/time parsing from string
  const parsedDate = timeToDate("2025-05-15", "8:00am");
  console.log(`\nParsed date (8:00 AM): ${parsedDate.toISOString()}`);
  console.log(`Formatted back with formatTime: ${formatTime(parsedDate)}`);
  
  // Verify that the time remains 8:00 AM regardless of the user's timezone
  console.log(`\nVerification that time remains 8:00 AM in any timezone:`);
  console.log(`Raw time in user timezone: ${new Date(parsedDate).toLocaleTimeString()}`);
  console.log(`Formatted time in facility timezone: ${formatTime(parsedDate)}`);
  
  // Test the isSameDay function with dates that cross midnight in different timezones
  console.log(`\nTesting isSameDay function with cross-timezone dates:`);
  
  // Create two dates - one at 11:30 PM in Dallas and one at 12:30 AM the next day in Dallas
  const latePMDate = createFacilityDate(2025, 4, 15, 23, 30, 0); // May 15, 2025 11:30 PM in Dallas
  const earlyAMDate = createFacilityDate(2025, 4, 16, 0, 30, 0);  // May 16, 2025 12:30 AM in Dallas
  
  console.log(`Late PM date (Dallas time): ${formatDateTimeRange(latePMDate, latePMDate)}`);
  console.log(`Early AM date (Dallas time): ${formatDateTimeRange(earlyAMDate, earlyAMDate)}`);
  console.log(`These dates should be on DIFFERENT days: ${isSameDay(latePMDate, earlyAMDate) ? 'FAILED' : 'PASSED'}`);
  
  // Create two dates on the same day but at different times
  const morningDate = createFacilityDate(2025, 4, 15, 8, 0, 0);   // May 15, 2025 8:00 AM in Dallas
  const eveningDate = createFacilityDate(2025, 4, 15, 20, 0, 0);  // May 15, 2025 8:00 PM in Dallas
  
  console.log(`Morning date (Dallas time): ${formatDateTimeRange(morningDate, morningDate)}`);
  console.log(`Evening date (Dallas time): ${formatDateTimeRange(eveningDate, eveningDate)}`);
  console.log(`These dates should be on SAME day: ${isSameDay(morningDate, eveningDate) ? 'PASSED' : 'FAILED'}`);
  
  // Test a date that would be on different days in different timezones
  // E.g., May 15 11:30 PM in Dallas would be May 16 in London but still May 15 in LA
  console.log(`\nCross timezone boundary test (11:30 PM Dallas time):`);
  console.log(`Late PM date ISO: ${latePMDate.toISOString()}`);
  console.log(`This date in Dallas: ${formatDateInFacilityTimezone(latePMDate)}`);
  console.log(`This date in user local time: ${latePMDate.toLocaleDateString()}`);
  console.log(`Day comparison with next day (should be different): ${isSameDay(latePMDate, addDays(latePMDate, 1)) ? 'FAILED' : 'PASSED'}`);
  
  console.log("=== END TEST ===");
}
