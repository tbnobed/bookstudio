import type { Studio, Booking } from "@shared/schema";
import { isSameDay } from "./dateUtils";

// Calculate the effective studio status based on bookings
export function calculateStudioStatus(studio: Studio, bookings: Booking[], currentDate: Date = new Date()): string {
  // If studio is explicitly set to maintenance, respect that setting
  if (studio.status === "maintenance") {
    return "maintenance";
  }
  
  // Check if there are any bookings for this studio on the current date
  const hasBookingsToday = bookings.some(booking => {
    const bookingStart = new Date(booking.start);
    const studioId = booking.studioId;
    
    return studioId === studio.id && isSameDay(bookingStart, currentDate);
  });
  
  // Return booked if there are bookings today, otherwise use the studio's configured status
  return hasBookingsToday ? "booked" : studio.status;
}

// Get the appropriate color class for a studio's status
export function getStudioStatusColor(status: string): string {
  switch (status) {
    case "available":
      return "bg-green-500";
    case "maintenance":
      return "bg-orange-500";
    case "booked":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
}