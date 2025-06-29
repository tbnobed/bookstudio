import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Booking, Studio, BookingStudio } from '@shared/schema';

type StudioStatus = 'available' | 'in-use' | 'maintenance' | 'upcoming';

interface StudioStatusInfo {
  status: StudioStatus;
  color: string; // CSS color class
  nextBooking?: Booking; // The next booking if status is 'upcoming'
  currentBooking?: Booking; // The current booking if status is 'in-use' or 'maintenance'
}

/**
 * Hook to get real-time status of studios
 * @param filteredBookings Optional array of pre-filtered bookings to use instead of fetching all bookings
 * @returns A function that returns the status of a studio
 */
export function useStudioStatus(filteredBookings?: Booking[]) {
  // Fetch all studios
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ['/api/studios'],
  });
  
  // Fetch all bookings (we'll filter client-side)
  const { data: fetchedBookings = [] } = useQuery<Booking[]>({
    queryKey: ['/api/bookings'],
    // Skip this query if we're using filtered bookings
    enabled: filteredBookings === undefined
  });
  
  // Use provided filtered bookings if available, otherwise use fetched bookings
  const bookings = filteredBookings || fetchedBookings;
  
  // Fetch booking-studio links
  const { data: bookingStudioLinks = [] } = useQuery<BookingStudio[]>({
    queryKey: ['/api/booking-studios'],
  });
  
  // State to hold current time (will update every minute)
  const [now, setNow] = useState(new Date());
  
  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000); // 60 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  /**
   * Get the current status of a studio
   * @param studioId The ID of the studio to check
   * @returns Status information for the studio
   */
  const getStudioStatus = (studioId: number): StudioStatusInfo => {
    // Find the studio
    const studio = studios.find(s => s.id === studioId);
    if (!studio) {
      return { 
        status: 'available',
        color: 'bg-green-500'
      };
    }
    
    // If studio is explicitly set to maintenance, respect that setting
    if (studio.status === 'maintenance') {
      return {
        status: 'maintenance',
        color: 'bg-orange-500'
      };
    }
    
    // Handle legacy 'booked' status as 'in-use'
    if (studio.status === 'booked') {
      return {
        status: 'in-use',
        color: 'bg-red-500'
      };
    }
    
    // Get bookings for this studio (both direct and via junction table)
    const studioBookings = bookings.filter(booking => {
      // Check direct assignment (legacy support)
      const directMatch = booking.studioId === studioId;
      
      // Check junction table links for multi-studio bookings
      const linkedMatch = bookingStudioLinks.some(link => 
        link.bookingId === booking.id && link.studioId === studioId
      );
      
      const isMatch = directMatch || linkedMatch;
      
      // Debug for specific studios
      if (studioId === 1 || studioId === 2) {
        console.log(`Studio ${studioId} checking booking ${booking.id} (${booking.title}):`);
        console.log(`  - Direct match: ${directMatch} (booking.studioId: ${booking.studioId})`);
        console.log(`  - Linked match: ${linkedMatch}`);
        console.log(`  - Final match: ${isMatch}`);
      }
      
      return isMatch;
    });
    
    // Check if there's a current booking (studio in use)
    const currentBooking = studioBookings.find(booking => {
      const startTime = new Date(booking.start);
      const endTime = new Date(booking.end);
      return startTime <= now && endTime > now;
    });
    
    // If there's a current booking, return the appropriate status
    if (currentBooking) {
      if (currentBooking.type === 'maintenance' || currentBooking.type === 'it_support') {
        return {
          status: 'maintenance',
          color: 'bg-orange-500',
          currentBooking
        };
      }
      return { 
        status: 'in-use',
        color: 'bg-red-500',
        currentBooking
      };
    }
    
    // Check if there's an upcoming booking today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    
    const upcomingBookings = studioBookings.filter(booking => {
      const startTime = new Date(booking.start);
      return startTime > now && startTime <= todayEnd;
    }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    
    // If there's an upcoming booking, return 'upcoming' status
    if (upcomingBookings.length > 0) {
      return { 
        status: 'upcoming',
        color: 'bg-yellow-500',
        nextBooking: upcomingBookings[0]
      };
    }
    
    // Otherwise, studio is available
    return { 
      status: 'available',
      color: 'bg-green-500'
    };
  };
  
  /**
   * Check if a studio is currently in use
   * @param studioId The ID of the studio to check
   * @returns true if the studio is in use, false otherwise
   */
  const isStudioInUse = (studioId: number): boolean => {
    const status = getStudioStatus(studioId);
    return status.status === 'in-use';
  };
  
  /**
   * Get a list of all studios with their current status
   * @returns An array of studios with their status
   */
  const getAllStudiosWithStatus = () => {
    console.log("getAllStudiosWithStatus called, studio count:", studios.length);
    console.log("bookingStudioLinks count:", bookingStudioLinks.length);
    console.log("bookings count:", bookings.length);
    
    // Debug specific booking 218
    const booking218 = bookings.find(b => b.id === 218);
    if (booking218) {
      console.log("Found booking 218:", booking218.title, "studioId:", booking218.studioId);
      const links = bookingStudioLinks.filter(link => link.bookingId === 218);
      console.log("Booking 218 links:", links);
    }
    
    return studios.map(studio => {
      const status = getStudioStatus(studio.id);
      
      // Debug studio status
      console.log(`Studio ${studio.id} (${studio.name}) status:`, status.status);
      if (status.currentBooking) {
        console.log(`  - Current booking: ${status.currentBooking.title}`);
      }
      if (status.nextBooking) {
        console.log(`  - Next booking: ${status.nextBooking.title} at ${status.nextBooking.start}`);
      }
      
      return {
        ...studio,
        statusInfo: status
      };
    });
  };
  
  return {
    getStudioStatus,
    isStudioInUse,
    getAllStudiosWithStatus,
    studios,
    bookings,
    bookingStudioLinks,
    now
  };
}