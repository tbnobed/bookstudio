import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the context shape
interface CalendarContextType {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  view: 'day' | 'week' | 'month';
  setView: (view: 'day' | 'week' | 'month') => void;
}

// Create the context with default values
const CalendarContext = createContext<CalendarContextType>({
  selectedDate: new Date(),
  setSelectedDate: () => {},
  view: 'day',
  setView: () => {},
});

// Custom hook to use the calendar context
export const useCalendarContext = () => useContext(CalendarContext);

// Provider component
interface CalendarProviderProps {
  children: ReactNode;
}

export const CalendarProvider: React.FC<CalendarProviderProps> = ({ children }) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');

  const value = {
    selectedDate,
    setSelectedDate,
    view,
    setView,
  };

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
};