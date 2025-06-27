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
 * Format a date as a time string for form inputs (HH:MM) in the facility timezone
 * 
 * @param date The date to format
 * @returns Time string in HH:MM format (e.g. "08:00")
 */
export function formatTimeForForm(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: FACILITY_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(date);
  const hour = parts.find(part => part.type === 'hour')?.value || '00';
  const minute = parts.find(part => part.type === 'minute')?.value || '00';
  
  return `${hour}:${minute}`;
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

/**
 * Format a date with a custom format string in the facility timezone
 * This function replaces date-fns format() to ensure proper timezone handling
 * 
 * @param date The date to format
 * @param formatStr Format string (basic patterns like 'EEEE, MMMM d, yyyy')
 * @returns Formatted date string in facility timezone
 */
export function formatInFacilityTimezone(date: Date, formatStr: string): string {
  // Basic format string replacement using Intl API for proper timezone handling
  let result = formatStr;
  
  // Days
  result = result.replace('EEEE', date.toLocaleDateString('en-US', { weekday: 'long', timeZone: FACILITY_TIMEZONE }));
  result = result.replace('EEE', date.toLocaleDateString('en-US', { weekday: 'short', timeZone: FACILITY_TIMEZONE }));
  
  // Months
  result = result.replace('MMMM', date.toLocaleDateString('en-US', { month: 'long', timeZone: FACILITY_TIMEZONE }));
  result = result.replace('MMM', date.toLocaleDateString('en-US', { month: 'short', timeZone: FACILITY_TIMEZONE }));
  result = result.replace('MM', date.toLocaleDateString('en-US', { month: '2-digit', timeZone: FACILITY_TIMEZONE }));
  
  // Days of month  
  result = result.replace('dd', date.toLocaleDateString('en-US', { day: '2-digit', timeZone: FACILITY_TIMEZONE }));
  result = result.replace(/\bd\b/, date.toLocaleDateString('en-US', { day: 'numeric', timeZone: FACILITY_TIMEZONE }));
  
  // Years
  result = result.replace('yyyy', date.toLocaleDateString('en-US', { year: 'numeric', timeZone: FACILITY_TIMEZONE }));
  result = result.replace('yy', date.toLocaleDateString('en-US', { year: '2-digit', timeZone: FACILITY_TIMEZONE }));
  
  return result;
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
  // Use the current date if none provided
  const safeDate = date ? new Date(date.getTime()) : new Date();
  
  // Convert to facility timezone for calculations
  const facilityFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: FACILITY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const facilityDateStr = facilityFormatter.format(safeDate);
  const [year, month, day] = facilityDateStr.split('-').map(Number);
  
  // Create a date in facility timezone
  const facilityDate = new Date(year, month - 1, day);
  
  // Get the day of the week (0-6, where 0 is Sunday)
  const dayOfWeek = facilityDate.getDay();
  
  // Calculate the start of the week (Sunday)
  const weekStart = new Date(facilityDate.getTime());
  weekStart.setDate(facilityDate.getDate() - dayOfWeek);
  
  // Create an array of dates for the week
  const weekDates: Date[] = [];
  
  // Generate 7 days starting from Sunday
  for (let i = 0; i < 7; i++) {
    const nextDate = new Date(weekStart.getTime());
    nextDate.setDate(weekStart.getDate() + i);
    weekDates.push(nextDate);
  }
  
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
 * Checks if two dates represent the same day in the facility timezone (Chicago)
 * This ensures bookings appear on the correct day regardless of user's local timezone
 * 
 * @param date1 First date to compare
 * @param date2 Second date to compare
 * @returns True if the dates represent the same day in Chicago timezone
 */
export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  // Make defensive copies to ensure we don't modify the inputs
  const d1 = typeof date1 === "string" ? new Date(date1) : new Date(date1.getTime());
  const d2 = typeof date2 === "string" ? new Date(date2) : new Date(date2.getTime());
  
  // Use Intl.DateTimeFormat to get the date components in the facility timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: FACILITY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Get the date parts for comparison
  const d1Parts = formatter.formatToParts(d1);
  const d2Parts = formatter.formatToParts(d2);
  
  // Extract day, month, year for both dates in facility timezone
  const getDatePart = (parts: Intl.DateTimeFormatPart[], type: string) => {
    const part = parts.find(p => p.type === type);
    return part ? part.value : '';
  };
  
  const d1Year = getDatePart(d1Parts, 'year');
  const d1Month = getDatePart(d1Parts, 'month');
  const d1Day = getDatePart(d1Parts, 'day');
  
  const d2Year = getDatePart(d2Parts, 'year');
  const d2Month = getDatePart(d2Parts, 'month');
  const d2Day = getDatePart(d2Parts, 'day');
  
  // Compare the date components directly
  const result = d1Year === d2Year && d1Month === d2Month && d1Day === d2Day;
  
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
  
  // Generate all time options including the full 24 hours
  for (let hour = 0; hour <= 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      // Special handling for hour 24 (midnight the next day) - only include 0 minutes
      if (hour === 24 && minute > 0) break;
      
      // Convert to 12-hour format
      let displayHour = hour % 12;
      if (displayHour === 0) displayHour = 12;
      
      const period = hour < 12 ? "am" : "pm";
      
      // Special case for exactly 24:00 (midnight next day)
      if (hour === 24) {
        timeOptions.push("12:00am");
        break;
      } else {
        timeOptions.push(`${displayHour}:${minute.toString().padStart(2, "0")}${period}`);
      }
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
  try {
    // Validate inputs before attempting to parse
    if (!dateStr || !timeStr) {
      console.error(`Invalid inputs: dateStr=${dateStr}, timeStr=${timeStr}`);
      throw new Error("Date and time values are required");
    }
    
    console.log(`timeToDate - Attempting to parse date=${dateStr}, time=${timeStr}`);
    
    // Extract hours and minutes from timeStr (format: "1:30pm", "12:00am", etc.)
    const timeParts = timeStr.match(/^(\d+):(\d+)([ap]m)$/i);
    if (!timeParts) {
      console.error(`Invalid time format: "${timeStr}"`);
      throw new Error(`Invalid time format: "${timeStr}". Expected format like "1:30pm" or "12:00am".`);
    }
    
    let [_, hours, minutes, period] = timeParts;
    let hourNum = parseInt(hours);
    const minuteNum = parseInt(minutes);
    
    // Validate parsed time components
    if (isNaN(hourNum) || isNaN(minuteNum)) {
      console.error(`Invalid time components: hours=${hourNum}, minutes=${minuteNum}`);
      throw new Error("Invalid time components");
    }
    
    // Convert to 24-hour format
    if (period.toLowerCase() === "pm" && hourNum < 12) {
      hourNum += 12;
    } else if (period.toLowerCase() === "am" && hourNum === 12) {
      hourNum = 0;
    }
    
    // Parse the date string (format: "YYYY-MM-DD")
    const dateParts = dateStr.split('-');
    if (dateParts.length !== 3) {
      console.error(`Invalid date format: "${dateStr}"`);
      throw new Error(`Invalid date format: "${dateStr}". Expected format "YYYY-MM-DD".`);
    }
    
    const [year, month, day] = dateParts.map(Number);
    
    // Validate date components
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      console.error(`Invalid date components: year=${year}, month=${month}, day=${day}`);
      throw new Error("Invalid date components");
    }
    
    if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      console.error(`Date values out of range: year=${year}, month=${month}, day=${day}`);
      throw new Error("Date values out of range");
    }
    
    // Use our createFacilityDate function with the year, month, day, hour, minute
    // This ensures the date is explicitly created in the facility's timezone
    // Note: month in createFacilityDate is 0-based, but the parsed month from dateStr is 1-based
    const dateObj = createFacilityDate(year, month - 1, day, hourNum, minuteNum);
    
    // Validate the created date object
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      console.error(`Invalid date object created: ${dateObj}`);
      throw new Error("Failed to create valid date object");
    }
    
    // Log for debugging
    console.log(`Date selected: ${dateStr}, time: ${timeStr}, parsed as: ${dateObj.toISOString()} (Dallas time)`);
    
    return dateObj;
  } catch (error) {
    console.error(`Error in timeToDate function:`, error);
    
    // Return a default date rather than throwing, to prevent form submission failures
    const nowDallas = new Date();
    console.warn(`Using fallback current time: ${nowDallas.toISOString()}`);
    throw new Error(`Failed to parse date/time: ${error instanceof Error ? error.message : String(error)}`);
  }
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
