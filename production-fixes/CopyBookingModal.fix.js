/**
 * Fix for CopyBookingModal.tsx to prevent UI getting stuck in "Creating..." state
 * 
 * Replace the useMutation section in CopyBookingModal.tsx with this code
 */

// Mutation to copy a booking to multiple dates
const copyBookingMutation = useMutation({
  mutationFn: async (data: { bookingId: number; dates: string[]; titleSuffix?: string }) => {
    const res = await apiRequest("POST", "/api/bookings/copy", data);
    return res.json();
  },
  onSuccess: (data) => {
    // Always reset the loading state 
    setIsCreating(false);
    
    const { success, message, results } = data;
    const successCount = results?.filter(r => r.success)?.length || 0;
    
    if (success) {
      toast({
        title: "Success!",
        description: message || `Booking copied to ${successCount} date${successCount !== 1 ? 's' : ''}.`,
        variant: "default",
      });
      
      // Invalidate relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/booking-studios"] });
      
      // Reset state and close the modal
      setSelectedDates([]);
      setTitleSuffix("");
      onClose();
    } else {
      // Some copies might have failed
      toast({
        title: "Partial Success",
        description: message || "Some booking copies could not be created due to conflicts.",
        variant: "default",
      });
    }
  },
  onError: (error: any) => {
    // Always reset the loading state
    setIsCreating(false);
    
    toast({
      title: "Error",
      description: error.message || "Failed to copy booking",
      variant: "destructive",
    });
  },
});