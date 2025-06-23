import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Booking, InsertBooking, InsertTemplate, Template } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { FACILITY_TIMEZONE } from "@/lib/dateUtils";

export function useStudioBookings(startDate?: Date, endDate?: Date) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Format dates for API request with explicit handling for facility timezone
  const formatDateParam = (date?: Date) => {
    if (!date) return undefined;
    
    // Make a defensive copy of the date to avoid modifying the original
    const dateCopy = new Date(date.getTime());
    
    // Log the date we're sending for debugging timezone issues
    console.log(`useStudioBookings formatDateParam - Input date: ${date.toISOString()}`);
    console.log(`useStudioBookings formatDateParam - Sending to API: ${dateCopy.toISOString()}`);
    
    // Ensure the date is in ISO format with the correct timezone handling
    return dateCopy.toISOString();
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
    refetchOnWindowFocus: true,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Fetch user's bookings
  const userBookingsQuery = useQuery<Booking[]>({
    queryKey: ["/api/bookings/user"],
    refetchOnWindowFocus: true,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Fetch templates
  const templatesQuery = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    refetchOnWindowFocus: true,
  });

  // Create a booking
  const createBooking = useMutation({
    mutationFn: async (booking: InsertBooking & { studioIds?: number[] }) => {
      console.log("[useStudioBookings] Creating booking with data:", booking);
      console.log("[useStudioBookings] studioIds in request:", booking.studioIds);
      console.log("[useStudioBookings] CRITICAL: Verifying studioIds array:", {
        studioIds: booking.studioIds,
        length: booking.studioIds?.length,
        type: typeof booking.studioIds,
        isArray: Array.isArray(booking.studioIds)
      });
      console.log("[useStudioBookings] CRITICAL: Booking data keys before API call:", Object.keys(booking));
      console.log("[useStudioBookings] CRITICAL: Full booking data stringified:", JSON.stringify(booking));
      
      // CRITICAL: Debug studioIds preservation
      console.log("[useStudioBookings] CRITICAL DEBUG: booking.studioIds before processing:", booking.studioIds);
      console.log("[useStudioBookings] CRITICAL DEBUG: studioIds type:", typeof booking.studioIds);
      console.log("[useStudioBookings] CRITICAL DEBUG: studioIds is array:", Array.isArray(booking.studioIds));
      console.log("[useStudioBookings] CRITICAL DEBUG: studioIds length:", booking.studioIds?.length);
      
      // CRITICAL: Ensure studioIds is preserved for API call
      const finalBookingData = {
        ...booking,
        studioIds: booking.studioIds || []
      };
      
      console.log("[useStudioBookings] CRITICAL: Final data being sent to API:", JSON.stringify(finalBookingData));
      console.log("[useStudioBookings] CRITICAL: Final studioIds in API data:", finalBookingData.studioIds);
      
      const res = await apiRequest("POST", "/api/bookings", finalBookingData);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Your booking has been created successfully.",
        variant: "default",
      });
      // Comprehensive cache invalidation for all mobile views
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && (
            key.includes('/api/bookings') || 
            key.includes('/api/booking-studios') ||
            key.includes('/api/public/booking-studios')
          );
        }
      });
      // Force refetch to ensure immediate updates
      queryClient.refetchQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/bookings');
        }
      });
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
      // Comprehensive cache invalidation for all mobile views
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && (
            key.includes('/api/bookings') || 
            key.includes('/api/booking-studios') ||
            key.includes('/api/public/booking-studios')
          );
        }
      });
      // Force refetch to ensure immediate updates
      queryClient.refetchQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/bookings');
        }
      });
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
      // Comprehensive cache invalidation for all mobile views
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && (
            key.includes('/api/bookings') || 
            key.includes('/api/booking-studios') ||
            key.includes('/api/public/booking-studios')
          );
        }
      });
      // Force refetch to ensure immediate updates
      queryClient.refetchQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/bookings');
        }
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete booking",
        variant: "destructive",
      });
    },
  });
  
  // Copy a booking to multiple dates
  const copyBooking = useMutation({
    mutationFn: async ({
      bookingId,
      dates,
      titleSuffix
    }: {
      bookingId: number;
      dates: string[];
      titleSuffix?: string;
    }) => {
      const res = await apiRequest("POST", "/api/bookings/copy", {
        bookingId,
        dates,
        titleSuffix
      });
      return res.json();
    },
    onSuccess: (data) => {
      const { success, message, results } = data;
      
      if (success) {
        toast({
          title: "Success!",
          description: message || "Your booking has been copied successfully.",
          variant: "default",
        });
      } else {
        // Some copies might have failed
        toast({
          title: "Partial Success",
          description: message || "Some booking copies could not be created due to conflicts.",
          variant: "default",
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to copy booking",
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
    copyBooking,
  };
}
