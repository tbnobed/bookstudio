import React, { useState, useEffect } from 'react';
import SimpleMobileForm from './SimpleMobileForm';
import { DirectMobileForm } from './DirectMobileForm';
import { FormBookingData, ApiBooking } from '../../types/bookings';
import { Studio } from '../../types/studios';
import { Template } from '../../types/templates';
import { PcrRoom } from '../../types/pcr-rooms';
import { NotificationGroup } from '../../types/notifications';
import { useStudios } from '../../hooks/useStudios';
import { usePcrRooms } from '../../hooks/usePcrRooms';
import { useTemplates } from '../../hooks/useTemplates';
import { useNotificationGroups } from '../../hooks/useNotificationGroups';

// Utility to detect if running on mobile device
function isMobileDevice() {
  return (
    window.innerWidth <= 768 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
  );
}

// Utility to detect if running on a very small screen or old mobile device
function isLowEndMobileDevice() {
  return (
    window.innerWidth <= 480 ||
    /Android 4|iPhone OS [0-8]_/i.test(navigator.userAgent)
  );
}

interface ResponsiveBookingFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  booking?: ApiBooking | null;
  selectedStudio?: number | null;
  defaultStudioId?: number;
}

/**
 * A responsive booking form that automatically chooses the most appropriate
 * form component based on the device capabilities.
 */
export function ResponsiveBookingForm({
  isOpen,
  onClose,
  onSubmit,
  booking = null,
  selectedStudio = null,
  defaultStudioId
}: ResponsiveBookingFormProps) {
  // Fetch all required data
  const { studios = [] } = useStudios();
  const { pcrRooms = [] } = usePcrRooms();
  const { templates = [] } = useTemplates();
  const { notificationGroups = [] } = useNotificationGroups();
  
  // Detect device capabilities
  const [isMobile, setIsMobile] = useState(isMobileDevice());
  const [isLowEnd, setIsLowEnd] = useState(isLowEndMobileDevice());
  
  // Update device capability detection on resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileDevice());
      setIsLowEnd(isLowEndMobileDevice());
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Prepare initial form data
  const initialData = booking ? {
    ...booking,
    start: new Date(booking.start),
    end: new Date(booking.end)
  } : null;
  
  // Handle form submission
  const handleSubmit = (data: any) => {
    console.log("ResponsiveBookingForm submit:", data);
    onSubmit(data);
  };
  
  // Choose the appropriate form component based on device capabilities
  if (isMobile) {
    // Mobile device - choose based on capability
    if (isLowEnd) {
      // Use ultra-simplified form for low-end devices
      return (
        <DirectMobileForm
          isOpen={isOpen}
          onClose={onClose}
          onSubmit={handleSubmit}
          booking={booking}
          selectedStudio={selectedStudio}
        />
      );
    } else {
      // Use simplified form for normal mobile devices
      return (
        <SimpleMobileForm
          isOpen={isOpen}
          onClose={onClose}
          onSubmit={handleSubmit}
          booking={booking}
          selectedStudio={selectedStudio}
        />
      );
    }
  }
  
  // Not a mobile device - just pass through to the original BookingModal
  // (handled by the parent component)
  return null;
}