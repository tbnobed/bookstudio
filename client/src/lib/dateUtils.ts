export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const SHORT_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
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

export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === "string" ? new Date(date1) : date1;
  const d2 = typeof date2 === "string" ? new Date(date2) : date2;
  
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function formatWeekRangeText(currentDate: Date | null | undefined): string {
  // If no date is provided, use current date
  // Always create a clean copy of the date to avoid reference issues
  const safeDate = currentDate ? new Date(currentDate.getTime()) : new Date();
  
  // Add timestamp for unique logging
  const timestamp = Date.now();
  console.log(`formatWeekRangeText - [Timestamp: ${timestamp}] Date input: ${safeDate.toISOString()}`);
  
  // Get the fresh week dates for the current date - always calculate this
  // directly from the input date to ensure it's up to date
  const weekDates = getWeekDates(safeDate);
  
  // Make clean copies of start and end dates
  const start = new Date(weekDates[0].getTime());
  const end = new Date(weekDates[6].getTime());
  
  console.log(`formatWeekRangeText - [Timestamp: ${timestamp}] Week start: ${start.toISOString()}, end: ${end.toISOString()}`);
  
  // Format month names
  const startMonth = MONTH_NAMES[start.getMonth()].substring(0, 3);
  const endMonth = MONTH_NAMES[end.getMonth()].substring(0, 3);
  
  // Format the week range text
  const result = (start.getMonth() === end.getMonth()) 
    ? `${startMonth} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`
    : `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${start.getFullYear()}`;
    
  console.log(`formatWeekRangeText - [Timestamp: ${timestamp}] Result: ${result}`);
  return result;
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
  
  // Use UTC methods to ensure consistent date behavior without timezone adjustments
  const dateObj = new Date();
  dateObj.setFullYear(year, month - 1, day);
  dateObj.setHours(hourNum, minuteNum, 0, 0);
  
  // Log for debugging
  console.log(`Date selected: ${dateStr}, time: ${timeStr}, parsed as: ${dateObj.toISOString()}`);
  
  return dateObj;
}
