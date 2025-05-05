import { useQuery } from "@tanstack/react-query";
import { BookingStudio } from "@shared/schema";

export function useBookingStudioLinks(bookingId?: number) {
  const queryString = bookingId ? `?bookingId=${bookingId}` : '';
  
  return useQuery<BookingStudio[]>({
    queryKey: ["/api/booking-studios", bookingId || "all"],
    queryFn: async () => {
      const response = await fetch(`/api/booking-studios${queryString}`);
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