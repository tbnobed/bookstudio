import type { Studio, Booking } from "@shared/schema";
import { isSameDay } from "./dateUtils";

// Calculate the effective studio status based on bookings
export function calculateStudioStatus(studio: Studio, bookings: Booking[], currentDate: Date = new Date()): string {
  // If studio is explicitly set to maintenance, respect that setting
  if (studio.status === "maintenance") {
    return "maintenance";
  }
  
  // Get the current time 
  const now = new Date();
  
  // Check if there are any active bookings for this studio right now
  const hasActiveBooking = bookings.some(booking => {
    // Get studioId regardless of property naming
    const studioId = booking.studioId;
    
    // Skip if not for this studio
    if (studioId !== studio.id) return false;
    
    // Get booking dates
    const bookingStart = new Date(booking.start);
    const bookingEnd = new Date(booking.end);
    
    // Only show as booked if we're currently within the booking time window
    // No longer requiring it to be the same day as currentDate
    return now >= bookingStart && now <= bookingEnd;
  });
  
  // Return booked if there are active bookings now, otherwise use the studio's configured status
  return hasActiveBooking ? "booked" : studio.status;
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