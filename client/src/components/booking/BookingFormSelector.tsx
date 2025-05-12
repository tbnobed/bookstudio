import React, { useState, useEffect } from 'react';
import { ApiBooking, FormBookingData } from '../../types/bookings';
import { ResponsiveBookingForm } from './ResponsiveBookingForm';

// Utility function to detect if running on mobile device
function isMobileDevice() {
  return (
    window.innerWidth <= 768 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
  );
}

interface BookingFormSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FormBookingData) => void;
  booking?: ApiBooking | null;
  selectedStudio?: number | null;
  defaultStudioId?: number;
}

export function BookingFormSelector({
  isOpen,
  onClose,
  onSubmit,
  booking,
  selectedStudio,
  defaultStudioId
}: BookingFormSelectorProps) {
  // Determine if we're on a mobile device
  const [isMobile, setIsMobile] = useState(isMobileDevice());
  
  // Detect screen resize to update mobile state
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileDevice());
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Handle form submission
  const handleSubmit = (data: FormBookingData) => {
    // Format and validate before submitting
    onSubmit(data);
  };

  // Use the direct mobile form for simplicity on mobile devices
  // In the future, we could add a toggle for users to switch between simple and detailed form
  return (
    <ResponsiveBookingForm
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      booking={booking}
      selectedStudio={selectedStudio}
      defaultStudioId={defaultStudioId}
      useSimpleForm={isMobile}
    />
  );
}