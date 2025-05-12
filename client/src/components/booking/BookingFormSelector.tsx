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
  selectedDate?: Date;
}

export function BookingFormSelector({
  isOpen,
  onClose,
  onSubmit,
  booking = null,
  selectedStudio = null,
  forceSimpleMode = false,
  selectedDate = new Date()
}: BookingFormSelectorProps) {
  // Clean and prepare booking data to ensure proper form population
  const processedBooking = React.useMemo(() => {
    if (!booking) return null;
    
    // Create a complete processed booking object with all fields properly formatted
    return {
      ...booking,
      id: booking.id,
      title: booking.title || '',
      description: booking.description || '',
      studioId: booking.studioId || selectedStudio || null,
      // Force date conversion for any string dates
      start: booking.start ? new Date(booking.start) : new Date(),
      end: booking.end ? new Date(booking.end) : new Date(),
      type: booking.type || 'production',
      status: booking.status || 'confirmed',
      severity: booking.severity || null,
      templateId: booking.templateId || 0,
      notifyList: booking.notifyList || [],
      color: booking.color || '#3b82f6',
      studioIds: booking.studioIds || (booking.studioId ? [booking.studioId] : [])
    };
  }, [booking, selectedStudio]);
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
    
    // Debug booking data
    console.log('BookingFormSelector - Booking data:', {
      hasBooking: !!booking,
      bookingId: booking?.id || 'none',
      bookingTitle: booking?.title || 'none',
      studio: selectedStudio,
      isOpen
    });
  }, [isLowEndDevice, booking, selectedStudio, isOpen]);
  
  // Add additional debugging
  useEffect(() => {
    console.log('BookingFormSelector - Processed booking data:', {
      original: booking,
      processed: processedBooking,
      isOpen,
      selectedDate
    });
  }, [booking, processedBooking, isOpen, selectedDate]);
  
  // Render the appropriate form based on device capability
  return isLowEndDevice ? (
    <DirectMobileForm
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={onSubmit}
      booking={processedBooking} // Use the processed booking
      selectedStudio={selectedStudio}
      selectedDate={selectedDate}
    />
  ) : (
    <SimpleMobileForm 
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={onSubmit}
      booking={processedBooking} // Use the processed booking
      selectedStudio={selectedStudio}
      selectedDate={selectedDate}
    />
  );
}