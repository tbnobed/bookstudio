import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

// Define the context interface
interface TimezoneContextType {
  timezone: string;
  setTimezone: (timezone: string) => void;
}

// Create context with default values
export const TimezoneContext = createContext<TimezoneContextType>({
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  setTimezone: () => {},
});

// Provider component
export function TimezoneProvider({ children }: { children: ReactNode }) {
  // Initialize timezone from localStorage if available, otherwise use browser default
  const [timezone, setTimezoneState] = useState<string>(() => {
    const savedTimezone = localStorage.getItem('bookstudio-timezone');
    return savedTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  });

  // Update localStorage when timezone changes
  const setTimezone = (newTimezone: string) => {
    setTimezoneState(newTimezone);
    localStorage.setItem('bookstudio-timezone', newTimezone);
  };

  // Make context value
  const contextValue = {
    timezone,
    setTimezone,
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

// Helper function to convert dates using the selected timezone
export function formatInTimezone(date: Date, options: Intl.DateTimeFormatOptions = {}, timezone?: string) {
  const ctx = useTimezone();
  const tz = timezone || ctx.timezone;
  
  return new Intl.DateTimeFormat('en-US', {
    ...options,
    timeZone: tz,
  }).format(date);
}

// Helper function to convert a UTC date to the selected timezone
export function utcToZonedTime(date: Date, timezone?: string) {
  const ctx = useTimezone();
  const tz = timezone || ctx.timezone;
  
  // Create a formatter that includes all parts of the date
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  
  // Format the date in the target timezone
  const parts = formatter.formatToParts(date);
  
  // Extract date components
  const year = parseInt(parts.find(part => part.type === 'year')?.value || '0');
  const month = parseInt(parts.find(part => part.type === 'month')?.value || '0') - 1;
  const day = parseInt(parts.find(part => part.type === 'day')?.value || '0');
  const hour = parseInt(parts.find(part => part.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(part => part.type === 'minute')?.value || '0');
  const second = parseInt(parts.find(part => part.type === 'second')?.value || '0');
  
  // Create a new Date object with components
  return new Date(year, month, day, hour, minute, second);
}

// Helper function to convert a date to UTC
export function zonedTimeToUtc(date: Date, timezone?: string) {
  const ctx = useTimezone();
  const tz = timezone || ctx.timezone;
  
  // Get the timezone offset for the given date
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'short',
  });
  
  // Format the date in the target timezone to get consistent components
  const parts = formatter.formatToParts(date);
  
  // Extract date components from the original date
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();
  
  // Create a Date object in UTC with those components
  const utcDate = new Date(Date.UTC(year, month, day, hour, minute, second));
  
  // Calculate the timezone offset
  const timeZonePart = parts.find(part => part.type === 'timeZoneName')?.value || '';
  const match = timeZonePart.match(/GMT([+-])(\d+)/);
  
  if (match) {
    const sign = match[1] === '+' ? -1 : 1; // Reverse the sign for offset
    const hours = parseInt(match[2]);
    utcDate.setHours(utcDate.getHours() + (sign * hours));
  }
  
  return utcDate;
}