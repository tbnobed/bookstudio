import { useState, useEffect } from "react";
import BookingModal from "./BookingModal";
import MobileBookingForm from "./MobileBookingForm";
// CSS imports removed after cleanup

export interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking?: any; // Optional existing booking for editing
  selectedDate?: Date;
  selectedStudio?: number;
  alertsOnly?: boolean; // If true, only maintenance and IT support options are available
}

export default function ResponsiveBookingModal(props: BookingModalProps) {
  // State to track if viewport is mobile size
  const [isMobileView, setIsMobileView] = useState(false);

  // Add debug log to check booking data
  useEffect(() => {
    console.log("ResponsiveBookingModal received props:", {
      isOpen: props.isOpen,
      booking: props.booking,
      hasBooking: !!props.booking,
      bookingId: props.booking?.id || "none"
    });
  }, [props.isOpen, props.booking]);

  // Effect to set up resize listener for mobile detection
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobileView(window.innerWidth < 768); // 768px is the standard md breakpoint in Tailwind
    };
    
    // Check initially
    checkIfMobile();
    
    // Set up event listener for window resize
    window.addEventListener('resize', checkIfMobile);
    
    // Clean up
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Enhanced props for the BookingModal with more robust date handling
  const enhancedProps = {
    ...props,
    // Ensure the booking prop is properly prepared
    booking: props.booking ? {
      ...props.booking,
      // Store both the string format (for API) and Date objects (for UI components)
      _startDate: new Date(props.booking.start),
      _endDate: new Date(props.booking.end),
      // Make sure all fields are correctly typed
      studioIds: props.booking.studioIds || (props.booking.studioId ? [props.booking.studioId] : [])
    } : undefined
  };
  
  console.log("ResponsiveBookingModal - Enhanced booking props:", enhancedProps);
  
  return (
    <>
      {/* The original BookingModal component will handle everything, 
          but with our CSS it will conditionally show either the desktop or mobile view */}
      <div className={isMobileView ? "mobile-view-active" : "desktop-view-active"}>
        <BookingModal {...enhancedProps} />
      </div>
    </>
  );
}