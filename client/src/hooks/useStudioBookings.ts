import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Booking, InsertBooking, InsertTemplate, Template } from "@shared/schema";
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
    
    // Log date range for debugging
    console.log(`useStudioBookings - Fetching bookings with date range: ${startDate?.toISOString()} to ${endDate?.toISOString()}`);
    
    return queryString ? `?${queryString}` : "";
  };

  // Fetch all bookings with proper query key structure
  const bookingsQuery = useQuery<Booking[]>({
    queryKey: ['/api/bookings', { start: formatDateParam(startDate), end: formatDateParam(endDate) }],
    queryFn: async () => {
      const queryString = getQueryString();
      console.log(`useStudioBookings - Executing fetch with query string: ${queryString}`);
      
      const response = await fetch(`/api/bookings${queryString}`);
      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }
      const data = await response.json();
      console.log(`useStudioBookings - Received ${data.length} bookings`);
      return data;
    },
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

  // Fetch templates
  const templatesQuery = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    refetchOnWindowFocus: true,
  });

  // Create a booking
  const createBooking = useMutation({
    mutationFn: async (booking: InsertBooking & { studioIds?: number[] }) => {
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

  // Create a template from booking data
  const createTemplate = useMutation({
    mutationFn: async (template: InsertTemplate) => {
      const res = await apiRequest("POST", "/api/templates", template);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Your template has been saved successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save template",
        variant: "destructive",
      });
    },
  });

  // Update a booking
  const updateBooking = useMutation({
    mutationFn: async ({ id, data, studioIds }: { id: number; data: Partial<InsertBooking>; studioIds?: number[] }) => {
      // Include studioIds in the request body if provided
      const requestData = studioIds ? { ...data, studioIds } : data;
      const res = await apiRequest("PATCH", `/api/bookings/${id}`, requestData);
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
    templates: templatesQuery.data || [],
    isLoading: bookingsQuery.isLoading || userBookingsQuery.isLoading,
    isError: bookingsQuery.isError || userBookingsQuery.isError,
    createBooking,
    createTemplate,
    updateBooking,
    deleteBooking,
  };
}
