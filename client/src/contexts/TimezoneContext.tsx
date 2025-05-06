import React, { createContext, useState, useContext, ReactNode } from 'react';

// Define constant for default timezone - America/New_York corresponds to Eastern Time (ET)
// This ensures the entire app uses this timezone by default
export const DEFAULT_TIMEZONE = 'America/New_York';

// List of common timezones for the dropdown selection
export const COMMON_TIMEZONES = [
  'America/New_York',      // Eastern Time
  'America/Chicago',       // Central Time
  'America/Denver',        // Mountain Time
  'America/Los_Angeles',   // Pacific Time
  'America/Anchorage',     // Alaska Time
  'Pacific/Honolulu',      // Hawaii Time
  'America/Toronto',       // Eastern Time - Canada
  'America/Vancouver',     // Pacific Time - Canada
  'Europe/London',         // GMT/BST
  'Europe/Paris',          // Central European Time
  'Asia/Tokyo',            // Japan
  'Australia/Sydney',      // Australia Eastern Time
];

// Define the context interface
interface TimezoneContextType {
  timezone: string;
  setTimezone: (timezone: string) => void;
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
  parseDate: (dateStr: string, timeStr: string) => Date;
  formatTimeForDisplay: (date: Date) => string;
  formatDateForForm: (date: Date) => string;
}

// Create context with default values
export const TimezoneContext = createContext<TimezoneContextType>({
  timezone: DEFAULT_TIMEZONE,
  setTimezone: () => {},
  formatDate: () => '',
  parseDate: () => new Date(),
  formatTimeForDisplay: () => '',
  formatDateForForm: () => '',
});

// Provider component
export function TimezoneProvider({ children }: { children: ReactNode }) {
  // Initialize timezone from localStorage if available, otherwise use default
  const [timezone, setTimezoneState] = useState<string>(() => {
    const savedTimezone = localStorage.getItem('bookstudio-timezone');
    return savedTimezone || DEFAULT_TIMEZONE;
  });

  // Update localStorage when timezone changes
  const setTimezone = (newTimezone: string) => {
    setTimezoneState(newTimezone);
    localStorage.setItem('bookstudio-timezone', newTimezone);
    console.log(`TimezoneContext: Updated timezone to ${newTimezone}`);
  };

  // Format a date according to the application's timezone
  const formatDate = (date: Date, options: Intl.DateTimeFormatOptions = {}) => {
    return new Intl.DateTimeFormat('en-US', {
      ...options,
      timeZone: timezone,
    }).format(date);
  };

  // Parse date and time strings into a Date object
  const parseDate = (dateStr: string, timeStr: string): Date => {
    // Extract time components
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
    
    // Parse date components
    const [year, month, day] = dateStr.split('-').map(Number);
    
    // Create a date in the application's timezone
    const dateObj = new Date();
    
    // Set the local components
    dateObj.setFullYear(year);
    dateObj.setMonth(month - 1); // JavaScript months are 0-based
    dateObj.setDate(day);
    dateObj.setHours(hourNum);
    dateObj.setMinutes(minuteNum);
    dateObj.setSeconds(0);
    dateObj.setMilliseconds(0);
    
    console.log(`TimezoneContext.parseDate: ${dateStr} ${timeStr} → ${dateObj.toISOString()}`);
    
    return dateObj;
  };

  // Format a time for display in the application's timezone
  const formatTimeForDisplay = (date: Date): string => {
    return formatDate(date, { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true,
      timeZone: timezone 
    });
  };

  // Format a date for form field (YYYY-MM-DD) in the application's timezone
  const formatDateForForm = (date: Date): string => {
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      timeZone: timezone 
    });
    
    const formattedDate = formatter.format(date);
    console.log(`TimezoneContext.formatDateForForm: ${date.toISOString()} → ${formattedDate}`);
    
    return formattedDate;
  };

  // Make context value
  const contextValue = {
    timezone,
    setTimezone,
    formatDate,
    parseDate,
    formatTimeForDisplay,
    formatDateForForm,
  };

  return (
    <TimezoneContext.Provider value={contextValue}>
      {children}
    </TimezoneContext.Provider>
  );
}

// Custom hook for consuming the context
export function useTimezone() {
  const context = useContext(TimezoneContext);
  if (!context) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
}