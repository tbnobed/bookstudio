import React, { useEffect } from 'react';
import { ApiBooking, FormBookingData } from '../../types/bookings';
import SimpleMobileForm from './SimpleMobileForm-new';
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
  alertMode?: boolean;
}

export function BookingFormSelector({
  isOpen,
  onClose,
  onSubmit,
  booking = null,
  selectedStudio = null,
  forceSimpleMode = false,
  selectedDate = new Date(),
  alertMode = false
}: BookingFormSelectorProps) {
  // Clean and prepare booking data to ensure proper form population
  const processedBooking = React.useMemo(() => {
    if (!booking) return null;
    
    console.log("BookingFormSelector - Original booking data:", booking);
    
    // Make deep copies of date objects but keep original string formats for API compatibility
    // This ensures the form components receive valid data without type conflicts
    const newBooking = { ...booking };
    
    // Ensure start and end are proper date objects for form processing
    // First check if we already have Date objects stored in _startDate/_endDate
    if (newBooking._startDate && newBooking._startDate instanceof Date) {
      console.log("BookingFormSelector - Using existing _startDate:", newBooking._startDate);
    } else if (newBooking.start) {
      // Create a new Date object from the start value
      (newBooking as any)._startDate = new Date(newBooking.start);
      console.log("BookingFormSelector - Created new _startDate from:", newBooking.start, 
        "Result:", (newBooking as any)._startDate);
    }
    
    if (newBooking._endDate && newBooking._endDate instanceof Date) {
      console.log("BookingFormSelector - Using existing _endDate:", newBooking._endDate);
    } else if (newBooking.end) {
      // Create a new Date object from the end value
      (newBooking as any)._endDate = new Date(newBooking.end);
      console.log("BookingFormSelector - Created new _endDate from:", newBooking.end, 
        "Result:", (newBooking as any)._endDate);
    }
    
    // Make sure all properties have values - enforce types and defaults
    newBooking.id = Number(newBooking.id) || 0;
    newBooking.title = String(newBooking.title || '');
    newBooking.description = String(newBooking.description || '');
    // Fix studioId - use selectedStudio if booking has null/0 studioId
    const studioIdValue = newBooking.studioId || selectedStudio;
    newBooking.studioId = (studioIdValue && studioIdValue > 0) ? studioIdValue : null;
    newBooking.pcrRoomId = newBooking.pcrRoomId !== undefined ? Number(newBooking.pcrRoomId) : null;
    newBooking.type = String(newBooking.type || 'production');
    newBooking.status = String(newBooking.status || 'confirmed');
    newBooking.severity = newBooking.severity || null;
    newBooking.templateId = Number(newBooking.templateId) || null;
    
    // Handle notification list correctly
    if (!newBooking.notifyList) {
      newBooking.notifyList = [];
    } else if (!Array.isArray(newBooking.notifyList)) {
      // Convert to array if not already
      newBooking.notifyList = String(newBooking.notifyList).split(',').filter(Boolean);
    }
    
    newBooking.color = String(newBooking.color || '#3b82f6');
    
    // Ensure studioIds exists as an array of numbers
    if (!newBooking.studioIds || !Array.isArray(newBooking.studioIds)) {
      (newBooking as any).studioIds = newBooking.studioId ? [Number(newBooking.studioId)] : [];
      console.log("BookingFormSelector - Created studioIds from studioId:", (newBooking as any).studioIds);
    } else {
      // Ensure all studioIds are numbers
      (newBooking as any).studioIds = (newBooking as any).studioIds.map(Number).filter(Boolean);
      console.log("BookingFormSelector - Using existing studioIds:", (newBooking as any).studioIds);
    }
    
    // Add userId if missing (required by API)
    if (!newBooking.userId) {
      newBooking.userId = 1; // Default to admin user
    }
    
    console.log("BookingFormSelector - Processed booking data:", newBooking);
    
    return newBooking;
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
      alertMode={alertMode}
    />
  ) : (
    <SimpleMobileForm 
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={onSubmit}
      booking={processedBooking}
      selectedStudio={selectedStudio}
      selectedDate={selectedDate}
      alertMode={alertMode}
    />
  );
}