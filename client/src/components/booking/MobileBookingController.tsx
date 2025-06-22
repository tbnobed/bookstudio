import React, { useState, useEffect } from 'react';
import { BookingFormSelector } from './BookingFormSelector';
import { FormBookingData, ApiBooking } from '../../types/bookings';
import { useStudioBookings } from '@/hooks/useStudioBookings';
import { useStudios } from '../../hooks/useStudios';
import { useToast } from '@/hooks/use-toast';

// Utility function to detect if running on mobile device
function isMobileDevice() {
  return (
    window.innerWidth <= 768 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
  );
}

interface MobileBookingControllerProps {
  isOpen: boolean;
  onClose: () => void;
  booking?: ApiBooking | null;
  selectedDate?: Date;
  selectedStudio?: number | null;
  alertsOnly?: boolean;
  onSuccess?: () => void;
}

/**
 * Component to handle mobile bookings
 * This controller decides whether to show the mobile form based on screen size
 */
export function MobileBookingController({
  isOpen,
  onClose,
  booking,
  selectedDate = new Date(),
  selectedStudio,
  alertsOnly = false,
  onSuccess
}: MobileBookingControllerProps) {
  const { toast } = useToast();
  const { studios = [] } = useStudios();
  const { createBooking, updateBooking } = useStudioBookings();
  
  // Decide if we should show the mobile form
  const [showMobileForm, setShowMobileForm] = useState(isMobileDevice());
  
  // Update mobile status on window resize
  useEffect(() => {
    const handleResize = () => {
      setShowMobileForm(isMobileDevice());
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Handle form submission
  const handleFormSubmit = (data: FormBookingData) => {
    console.log("Mobile form submission:", data);
    
    // Create or update booking
    if (booking && booking.id > 0) {
      // Update existing booking
      updateBooking.mutate(
        {
          id: booking.id,
          data: {
            title: data.title,
            description: data.description,
            studioId: data.studioId,
            pcrRoomId: data.pcrRoomId || 0,
            type: data.type,
            start: new Date(data.start),
            end: new Date(data.end),
            templateId: data.templateId || null,
            status: data.status,
            severity: data.severity,
            color: data.color
          },
          studioIds: [data.studioId] // For now just use single studio
        },
        {
          onSuccess: () => {
            toast({
              title: 'Success',
              description: 'Booking updated successfully',
              variant: 'default'
            });
            onSuccess?.();
            onClose();
          },
          onError: (error) => {
            console.error('Error updating booking:', error);
            toast({
              title: 'Error',
              description: 'Failed to update booking',
              variant: 'destructive'
            });
          }
        }
      );
    } else {
      // Create a new booking
      createBooking.mutate(
        {
          title: data.title,
          description: data.description,
          studioId: data.studioId,
          pcrRoomId: data.pcrRoomId || 0,
          type: data.type,
          start: new Date(data.start),
          end: new Date(data.end),
          templateId: data.templateId || null,
          status: data.status,
          severity: data.severity,
          color: data.color,
          studioIds: [data.studioId] // For now just use single studio
        },
        {
          onSuccess: () => {
            toast({
              title: 'Success',
              description: 'Booking created successfully',
              variant: 'default'
            });
            onSuccess?.();
            onClose();
          },
          onError: (error) => {
            console.error('Error creating booking:', error);
            toast({
              title: 'Error',
              description: 'Failed to create booking',
              variant: 'destructive'
            });
          }
        }
      );
    }
  };

  // Only render when the modal is open
  if (!isOpen) return null;
  
  // If we're on mobile, show the mobile form selector
  if (showMobileForm) {
    return (
      <BookingFormSelector
        isOpen={isOpen}
        onClose={onClose}
        onSubmit={handleFormSubmit}
        booking={booking}
        selectedStudio={selectedStudio}
        selectedDate={selectedDate}
      />
    );
  }
  
  // If we're not on mobile, don't render anything
  // This allows the parent component to render its own desktop view
  return null;
}