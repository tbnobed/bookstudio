import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Booking, Studio } from '@shared/schema';

type StudioStatus = 'available' | 'in-use' | 'maintenance' | 'upcoming';

interface StudioStatusInfo {
  status: StudioStatus;
  color: string; // CSS color class
  nextBooking?: Booking; // The next booking if status is 'upcoming'
  currentBooking?: Booking; // The current booking if status is 'in-use' or 'maintenance'
}

/**
 * Hook to get real-time status of studios
 * @returns A function that returns the status of a studio
 */
export function useStudioStatus() {
  // Fetch all studios
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ['/api/studios'],
  });
  
  // Fetch all bookings (we'll filter client-side)
  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ['/api/bookings'],
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
    // Get bookings for this studio
    const studioBookings = bookings.filter(booking => booking.studioId === studioId);
    
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
          color: 'bg-amber-500',
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
    return studios.map(studio => ({
      ...studio,
      statusInfo: getStudioStatus(studio.id)
    }));
  };
  
  return {
    getStudioStatus,
    isStudioInUse,
    getAllStudiosWithStatus,
    studios,
    bookings,
    now
  };
}