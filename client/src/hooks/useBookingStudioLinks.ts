import { useQuery } from "@tanstack/react-query";
import { BookingStudio } from "@shared/schema";

// Default function for authenticated pages
export function useBookingStudioLinks(bookingId?: number, usePublicAPI: boolean = false) {
  const queryString = bookingId ? `?bookingId=${bookingId}` : '';
  const apiEndpoint = usePublicAPI ? '/api/public/booking-studios' : '/api/booking-studios';
  
  return useQuery<BookingStudio[]>({
    queryKey: [apiEndpoint, bookingId || "all"],
    queryFn: async () => {
      const response = await fetch(`${apiEndpoint}${queryString}`);
      if (!response.ok) {
        throw new Error('Failed to fetch booking-studio links');
      }
      const data = await response.json();
      console.log(`Retrieved ${data.length} booking-studio links`);
      return data;
    },
    refetchInterval: 3000, // Refetch every 3 seconds to keep UI in sync
    refetchOnWindowFocus: true,
  });
}

// Convenience function for public pages - always uses public API endpoint
export function usePublicBookingStudioLinks(bookingId?: number) {
  return useBookingStudioLinks(bookingId, true);
}