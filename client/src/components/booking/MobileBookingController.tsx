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
  // alertsOnly removed - this controller only handles bookings now
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
    console.log("[MOBILE CONTROLLER] ===== FORM SUBMISSION RECEIVED =====");
    console.log("[MOBILE CONTROLLER] Raw data received:", JSON.stringify(data, null, 2));
    console.log("[MOBILE CONTROLLER] CRITICAL CHECK - data object keys:", Object.keys(data));
    console.log("[MOBILE CONTROLLER] CRITICAL CHECK - has studioIds property?", 'studioIds' in data);
    console.log("[MOBILE CONTROLLER] Studio data check:", {
      studioId: data.studioId,
      studioIds: data.studioIds,
      studioIdsLength: data.studioIds?.length,
      studioIdsType: typeof data.studioIds,
      isArray: Array.isArray(data.studioIds),
      rawStudioIds: data.studioIds,
      stringifiedStudioIds: JSON.stringify(data.studioIds)
    });
    
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
            pcrRoomId: data.pcrRoomId || null,
            type: data.type,
            start: new Date(data.start),
            end: new Date(data.end),
            templateId: data.templateId || null,
            status: data.status,
            // severity removed - production bookings don't use severity
            color: data.color
          },
          studioIds: data.studioIds || (data.studioId ? [data.studioId] : []) // CRITICAL: Pass studioIds array for multi-studio support
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
      // Create new booking with multi-studio support
      console.log('[MOBILE CONTROLLER] ===== CREATE BOOKING DEBUG =====');
      console.log('[MOBILE CONTROLLER] Raw data received:', JSON.stringify(data, null, 2));
      console.log('[MOBILE CONTROLLER] Raw data.studioIds:', data.studioIds);
      console.log('[MOBILE CONTROLLER] Raw data.studioIds type:', typeof data.studioIds);
      console.log('[MOBILE CONTROLLER] Raw data.studioIds length:', data.studioIds?.length);
      console.log('[MOBILE CONTROLLER] Raw data.studioIds isArray:', Array.isArray(data.studioIds));
      
      const createData = {
        title: data.title,
        description: data.description,
        studioId: data.studioId,
        studioIds: data.studioIds || (data.studioId ? [data.studioId] : []), // Use actual studioIds array
        pcrRoomId: data.pcrRoomId || null,
        type: data.type,
        start: new Date(data.start),
        end: new Date(data.end),
        templateId: data.templateId || null,
        status: data.status,
        // severity removed - production bookings don't use severity
        color: data.color
      };
      
      console.log('[MOBILE CONTROLLER] ===== CREATE DATA PREPARED =====');
      console.log('[MOBILE CONTROLLER] Create data being sent:', JSON.stringify(createData, null, 2));
      console.log('[MOBILE CONTROLLER] Create data studioIds:', createData.studioIds);
      console.log('[MOBILE CONTROLLER] Create data studioIds type:', typeof createData.studioIds);
      console.log('[MOBILE CONTROLLER] Create data studioIds length:', createData.studioIds?.length);
      console.log('[MOBILE CONTROLLER] Create data studioIds isArray:', Array.isArray(createData.studioIds));
      
      createBooking.mutate(createData,
        {
          onSuccess: (result) => {
            console.log("[MOBILE CONTROLLER] Booking creation successful:", result);
            toast({
              title: 'Success',
              description: `Booking created successfully${createData.studioIds?.length > 1 ? ` across ${createData.studioIds.length} studios` : ''}`,
              variant: 'default'
            });
            onSuccess?.();
            onClose();
          },
          onError: (error) => {
            console.error('[MOBILE CONTROLLER] Error creating booking:', error);
            console.error('[MOBILE CONTROLLER] Full error details:', JSON.stringify(error));
            toast({
              title: 'Error',
              description: error?.message || 'Failed to create booking',
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
        // alertMode removed - BookingFormSelector only handles bookings
      />
    );
  }
  
  // If we're not on mobile, don't render anything
  // This allows the parent component to render its own desktop view
  return null;
}