import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Trash2, Link, Unlink } from "lucide-react";

import { Booking } from "@shared/schema";

interface LinkedBookingDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
  linkedBookingsCount?: number;
}

export default function LinkedBookingDeleteModal({
  isOpen,
  onClose,
  booking,
  linkedBookingsCount = 0,
}: LinkedBookingDeleteModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [deleteOption, setDeleteOption] = useState<"single" | "all">("single");
  const [isDeleting, setIsDeleting] = useState(false);

  // Mutation to delete booking with linked option support
  const deleteBookingMutation = useMutation({
    mutationFn: async (data: { bookingId: number; deleteLinked?: boolean }) => {
      const params = new URLSearchParams();
      if (data.deleteLinked) {
        params.append('deleteLinked', 'true');
      }
      
      const url = `/api/bookings/${data.bookingId}${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await apiRequest("DELETE", url);
      return res.json();
    },
    onSuccess: (data) => {
      // Invalidate all booking queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/booking-studios"] });
      
      const message = data.message || 
        (deleteOption === "all" 
          ? `Successfully deleted all linked bookings` 
          : "Booking deleted successfully");
          
      toast({
        title: "Success!",
        description: message,
        variant: "default",
      });
      
      // Reset state and close modal
      setDeleteOption("single");
      onClose();
    },
    onError: (error: any) => {
      console.error("Error deleting booking:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete booking",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsDeleting(false);
    },
  });

  const handleDelete = async () => {
    if (!booking?.id) return;
    
    setIsDeleting(true);
    await deleteBookingMutation.mutate({
      bookingId: booking.id,
      deleteLinked: deleteOption === "all",
    });
  };

  // Check if this booking is part of a linked group
  const isLinkedBooking = booking.linkedGroupId && linkedBookingsCount > 1;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Trash2 className="h-5 w-5 mr-2 text-red-500" />
            Delete Booking
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-medium">Booking Details</h3>
            <div className="text-sm text-gray-600">
              <p><strong>Title:</strong> {booking.title}</p>
              <p><strong>Date:</strong> {new Date(booking.start).toLocaleDateString()}</p>
              <p><strong>Time:</strong> {new Date(booking.start).toLocaleTimeString()} - {new Date(booking.end).toLocaleTimeString()}</p>
            </div>
          </div>

          {isLinkedBooking && (
            <>
              <Alert>
                <Link className="h-4 w-4" />
                <AlertDescription>
                  This booking is part of a linked group with {linkedBookingsCount} total bookings.
                  You can delete just this occurrence or all linked bookings.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Deletion Options</Label>
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant={deleteOption === "single" ? "default" : "outline"}
                    className="w-full justify-start text-sm h-auto py-3"
                    onClick={() => setDeleteOption("single")}
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    Delete only this occurrence
                  </Button>
                  <Button
                    type="button"
                    variant={deleteOption === "all" ? "default" : "outline"}
                    className="w-full justify-start text-sm h-auto py-3"
                    onClick={() => setDeleteOption("all")}
                  >
                    <Link className="h-4 w-4 mr-2" />
                    Delete all {linkedBookingsCount} linked bookings
                  </Button>
                </div>
              </div>
            </>
          )}

          {!isLinkedBooking && (
            <Alert>
              <AlertDescription>
                This action cannot be undone. This will permanently delete the booking.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center space-x-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>
                  {isLinkedBooking && deleteOption === "all" 
                    ? `Delete All ${linkedBookingsCount}`
                    : "Delete"
                  }
                </span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}