import React from 'react';
import { ApiBooking, FormBookingData } from '../../types/bookings';
import { SimpleMobileForm } from './SimpleMobileForm';
import { DirectMobileForm } from './DirectMobileForm';

// Device capability thresholds
const LOW_END_DEVICE_THRESHOLD = {
  maxMemory: 2, // GB
  maxWidth: 375 // pixels
};

// Component to intelligently select the appropriate form based on device capabilities
interface BookingFormSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FormBookingData) => void;
  booking?: ApiBooking | null;
  selectedStudio?: number | null;
  forceSimpleMode?: boolean;
}

export function BookingFormSelector({
  isOpen,
  onClose,
  onSubmit,
  booking = null,
  selectedStudio = null,
  forceSimpleMode = false
}: BookingFormSelectorProps) {
  // Detect if we're on a low-end device based on screen size and memory
  const isLowEndDevice = React.useMemo(() => {
    if (forceSimpleMode) return true;
    
    // Check device memory if available (Chrome-specific)
    const hasLimitedMemory = (navigator as any).deviceMemory && (navigator as any).deviceMemory < LOW_END_DEVICE_THRESHOLD.maxMemory;
    
    // Check screen size
    const hasSmallScreen = window.innerWidth <= LOW_END_DEVICE_THRESHOLD.maxWidth;
    
    // Check for slow connection
    const hasSlowConnection = (navigator as any).connection && 
      ((navigator as any).connection.effectiveType === '2g' || 
       (navigator as any).connection.effectiveType === 'slow-2g');
    
    // Check for Android older than version 7 (API level 24)
    const isOldAndroid = /Android/.test(navigator.userAgent) && 
      parseFloat(navigator.userAgent.match(/Android\s+([\d.]+)/)?.[1] || '99') < 7;
    
    // Check for mobile device with likely limited capabilities
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Consider it a low-end device if it meets any two of these criteria
    const lowEndFactors = [
      hasLimitedMemory,
      hasSmallScreen,
      hasSlowConnection,
      isOldAndroid,
      isMobileDevice
    ].filter(Boolean).length;
    
    return lowEndFactors >= 2;
  }, [forceSimpleMode]);
  
  // Log detection results
  React.useEffect(() => {
    console.log('BookingFormSelector - Device detection:', {
      isLowEndDevice,
      width: window.innerWidth,
      deviceMemory: (navigator as any).deviceMemory || 'unknown',
      connection: (navigator as any).connection?.effectiveType || 'unknown',
      userAgent: navigator.userAgent
    });
  }, [isLowEndDevice]);
  
  // Render the appropriate form based on device capability
  return isLowEndDevice ? (
    <DirectMobileForm
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={onSubmit}
      booking={booking}
      selectedStudio={selectedStudio}
    />
  ) : (
    <SimpleMobileForm 
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={onSubmit}
      booking={booking}
      selectedStudio={selectedStudio}
    />
  );
}