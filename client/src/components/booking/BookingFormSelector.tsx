import React, { useState, useEffect } from 'react';
import { SimpleMobileForm } from './SimpleMobileForm';
import { DirectMobileForm } from './DirectMobileForm';
import { FormBookingData, ApiBooking } from '../../types/bookings';

// Utility to detect if running on low-end mobile device
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

interface BookingFormSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FormBookingData) => void;
  booking?: ApiBooking | null;
  selectedStudio?: number | null;
  defaultStudioId?: number;
}

/**
 * This component selects the appropriate mobile form based on:
 * 1. The user's device capabilities
 * 2. User preferences (if implemented)
 * 3. Screen size
 * 
 * For very low-end devices or small screens, it uses the ultra-simple DirectMobileForm.
 * For better devices, it uses SimpleMobileForm which has more features.
 */
export function BookingFormSelector({
  isOpen,
  onClose,
  onSubmit,
  booking,
  selectedStudio,
  defaultStudioId
}: BookingFormSelectorProps) {
  // Check if we should use the super-simple form
  const [useDirectForm, setUseDirectForm] = useState(isLowEndMobileDevice());
  
  // Update on resize
  useEffect(() => {
    const handleResize = () => {
      setUseDirectForm(isLowEndMobileDevice());
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Handle form submission
  const handleSubmit = (data: FormBookingData) => {
    console.log("Form selector received form data:", data);
    onSubmit(data);
  };
  
  // If modal is not open, don't render anything
  if (!isOpen) return null;
  
  // Choose the appropriate form based on device capability
  return useDirectForm ? (
    <DirectMobileForm
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      booking={booking}
      selectedStudio={selectedStudio || defaultStudioId}
    />
  ) : (
    <SimpleMobileForm
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      booking={booking}
      selectedStudio={selectedStudio || defaultStudioId}
    />
  );
}