import { useQuery } from "@tanstack/react-query";
import { Booking } from "@shared/schema";

export function useLinkedBookings(linkedGroupId?: string | null) {
  return useQuery<Booking[], Error>({
    queryKey: ["/api/bookings/linked", linkedGroupId],
    queryFn: async () => {
      if (!linkedGroupId) {
        return [];
      }
      
      const response = await fetch(`/api/bookings/linked/${linkedGroupId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch linked bookings");
      }
      return response.json();
    },
    enabled: !!linkedGroupId,
  });
}