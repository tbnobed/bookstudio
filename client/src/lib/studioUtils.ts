import type { Studio, Booking, BookingStudio } from "@shared/schema";
import { isSameDay } from "./dateUtils";

/**
 * Calculate the effective studio status based on bookings and booking-studio links
 * @param studio The studio to check
 * @param bookings All bookings in the system 
 * @param currentDate The date to check against (defaults to current time)
 * @param bookingStudioLinks The booking-studio junction table links
 * @returns Status string: "available", "maintenance", or "in-use"
 */
export function calculateStudioStatus(
  studio: Studio, 
  bookings: Booking[], 
  currentDate: Date = new Date(), 
  bookingStudioLinks: BookingStudio[] = []
): string {
  // If studio is explicitly set to maintenance, respect that setting
  if (studio.status === "maintenance") {
    return "maintenance";
  }
  
  // Use provided date or current time
  const now = currentDate;
  
  // Check if there are any active bookings for this studio right now
  const hasActiveBooking = bookings.some(booking => {
    // First, check traditional studioId (kept for backwards compatibility)
    const directMatch = booking.studioId === studio.id;
    
    // Then, check junction table links for multi-studio bookings
    const linkedMatch = bookingStudioLinks.some(link => 
      link.bookingId === booking.id && link.studioId === studio.id
    );
    
    // Skip if not for this studio through either direct or linked relationship
    if (!directMatch && !linkedMatch) return false;
    
    // Get booking dates
    const bookingStart = new Date(booking.start);
    const bookingEnd = new Date(booking.end);
    
    // Only show as in-use if we're currently within the booking time window
    return now >= bookingStart && now <= bookingEnd;
  });
  
  // Convert legacy "booked" status to "in-use" for consistency
  if (studio.status === "booked") {
    return "in-use";
  }
  
  // Return "in-use" status if there are active bookings now, otherwise use the studio's configured status
  return hasActiveBooking ? "in-use" : studio.status;
}

/**
 * Get the appropriate color class for a studio's status
 * @param status The studio status: "available", "maintenance", "in-use", or legacy "booked"
 * @returns CSS color class to use for the status indicator
 */
export function getStudioStatusColor(status: string): string {
  switch (status) {
    case "available":
      return "bg-green-500";
    case "maintenance":
      return "bg-orange-500";
    case "booked": // backward compatibility
    case "in-use":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
}