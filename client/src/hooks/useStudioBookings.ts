import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Booking, InsertBooking } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useStudioBookings(startDate?: Date, endDate?: Date) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Format dates for API request
  const formatDateParam = (date?: Date) => {
    if (!date) return undefined;
    return date.toISOString();
  };

  // Build query string for date range filter
  const getQueryString = () => {
    const params = new URLSearchParams();
    if (startDate) params.append("start", formatDateParam(startDate)!);
    if (endDate) params.append("end", formatDateParam(endDate)!);
    const queryString = params.toString();
    return queryString ? `?${queryString}` : "";
  };

  // Fetch all bookings
  const bookingsQuery = useQuery<Booking[]>({
    queryKey: ["/api/bookings" + getQueryString()],
    enabled: true,
    refetchInterval: 3000, // Refetch every 3 seconds to keep UI in sync
    refetchOnWindowFocus: true,
  });

  // Fetch user's bookings
  const userBookingsQuery = useQuery<Booking[]>({
    queryKey: ["/api/bookings/user"],
    refetchInterval: 3000, // Refetch every 3 seconds
    refetchOnWindowFocus: true,
  });

  // Create a booking
  const createBooking = useMutation({
    mutationFn: async (booking: InsertBooking) => {
      const res = await apiRequest("POST", "/api/bookings", booking);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Your booking has been created successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create booking",
        variant: "destructive",
      });
    },
  });

  // Update a booking
  const updateBooking = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertBooking> }) => {
      const res = await apiRequest("PATCH", `/api/bookings/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Your booking has been updated successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update booking",
        variant: "destructive",
      });
    },
  });

  // Delete a booking
  const deleteBooking = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/bookings/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Your booking has been deleted successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete booking",
        variant: "destructive",
      });
    },
  });

  return {
    bookings: bookingsQuery.data || [],
    userBookings: userBookingsQuery.data || [],
    isLoading: bookingsQuery.isLoading || userBookingsQuery.isLoading,
    isError: bookingsQuery.isError || userBookingsQuery.isError,
    createBooking,
    updateBooking,
    deleteBooking,
  };
}
