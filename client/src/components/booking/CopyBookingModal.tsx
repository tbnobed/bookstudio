import { useState } from "react";
import { format, addDays, parse, isBefore } from "date-fns";
import { Calendar as CalendarIcon, Copy, Info } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Booking } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FACILITY_TIMEZONE } from "@/lib/dateUtils";

interface CopyBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
}

export default function CopyBookingModal({ isOpen, onClose, booking }: CopyBookingModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [titleSuffix, setTitleSuffix] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  
  const bookingDate = new Date(booking.start);
  
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
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedDates.length === 0) {
      toast({
        title: "No dates selected",
        description: "Please select at least one date to copy the booking to.",
        variant: "destructive",
      });
      return;
    }
    
    setIsCreating(true);
    
    // Format dates for API - Use exact YYYY-MM-DD format to avoid timezone issues
    const formattedDates = selectedDates.map(date => {
      // Get the components and create a string in YYYY-MM-DD format
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      console.log(`Copy booking - Processing date: Original=${date.toISOString()}, Formatted=${dateStr}`);
      return dateStr;
    });
    
    await copyBookingMutation.mutate({
      bookingId: booking.id,
      dates: formattedDates,
      titleSuffix: titleSuffix.trim() || undefined,
    });
  };
  
  // Toggle date selection
  const toggleDateSelection = (date: Date) => {
    setSelectedDates(prev => {
      // Check if the date is already selected
      const existingIndex = prev.findIndex(d => 
        d.getFullYear() === date.getFullYear() && 
        d.getMonth() === date.getMonth() && 
        d.getDate() === date.getDate()
      );
      
      if (existingIndex >= 0) {
        // Remove the date if already selected
        return prev.filter((_, i) => i !== existingIndex);
      } else {
        // Add the date if not selected
        return [...prev, date];
      }
    });
  };
  
  // Check if a date is already selected
  const isDateSelected = (date: Date) => {
    return selectedDates.some(d => 
      d.getFullYear() === date.getFullYear() && 
      d.getMonth() === date.getMonth() && 
      d.getDate() === date.getDate()
    );
  };
  
  // Format the time range (e.g., "9:00 AM - 11:00 AM")
  const formatTimeRange = () => {
    const start = new Date(booking.start);
    const end = new Date(booking.end);
    
    return `${format(start, "h:mm a")} - ${format(end, "h:mm a")} (${FACILITY_TIMEZONE})`;
  };
  
  // Calculate the duration in hours and minutes
  const getDuration = () => {
    const start = new Date(booking.start);
    const end = new Date(booking.end);
    const durationMs = end.getTime() - start.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return { hours, minutes };
  };
  
  const { hours, minutes } = getDuration();
  const durationText = `${hours > 0 ? `${hours} hour${hours !== 1 ? 's' : ''}` : ''}${hours > 0 && minutes > 0 ? ' and ' : ''}${minutes > 0 ? `${minutes} minute${minutes !== 1 ? 's' : ''}` : ''}`;
  
  // Don't allow selection of dates before today
  const isPastDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return isBefore(date, today);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Copy className="h-5 w-5 mr-2" />
            Copy Booking to Multiple Dates
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-medium">Booking Details</h3>
            <div className="text-sm">
              <p><strong>Title:</strong> {booking.title}</p>
              <p><strong>Time:</strong> {formatTimeRange()}</p>
              <p><strong>Duration:</strong> {durationText}</p>
              <p><strong>Original Date:</strong> {format(bookingDate, "MMMM d, yyyy")}</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="titleSuffix">Title Suffix (Optional)</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="titleSuffix"
                value={titleSuffix}
                onChange={(e) => setTitleSuffix(e.target.value)}
                placeholder="e.g., 'Week 2' or 'Copy'"
                className="flex-1"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" type="button">
                    <Info className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-2">
                  <p className="text-sm">
                    Adding a suffix will help distinguish copied bookings. 
                    For example, "{booking.title} - Week 2".
                  </p>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Select Dates to Copy To</Label>
            <div className="border rounded-md p-2">
              <Calendar
                mode="multiple"
                selected={selectedDates}
                onSelect={(dates) => dates && setSelectedDates(dates)}
                disabled={isPastDate}
                initialFocus
                className="w-full"
              />
            </div>
            
            {selectedDates.length > 0 && (
              <div className="text-sm">
                <span className="font-medium">Selected dates ({selectedDates.length}):</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedDates.map((date, index) => (
                    <div 
                      key={index} 
                      className="bg-primary/10 text-primary rounded px-2 py-1 text-xs flex items-center"
                    >
                      {format(date, "MMM d, yyyy")}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {selectedDates.length > 5 && (
            <Alert>
              <AlertDescription>
                You're about to create {selectedDates.length} copies of this booking. 
                Please ensure this is intentional.
              </AlertDescription>
            </Alert>
          )}
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={selectedDates.length === 0 || isCreating}
            >
              {isCreating ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </span>
              ) : (
                <span className="flex items-center">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Booking{selectedDates.length > 0 ? ` (${selectedDates.length})` : ''}
                </span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}