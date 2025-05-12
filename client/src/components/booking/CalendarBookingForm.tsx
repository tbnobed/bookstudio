import React from 'react';
import BookingModal from './BookingModal';
import { MobileBookingController } from './MobileBookingController';
import { ApiBooking } from '../../types/bookings';

interface CalendarBookingFormProps {
  isOpen: boolean;
  onClose: () => void;
  booking?: ApiBooking | null;
  selectedDate?: Date;
  selectedStudio?: number | null;
  alertsOnly?: boolean;
  onSuccess?: () => void;
}

/**
 * A smart wrapper component that chooses between mobile and desktop booking forms
 * based on the device screen size.
 */
export function CalendarBookingForm({
  isOpen,
  onClose,
  booking,
  selectedDate,
  selectedStudio,
  alertsOnly,
  onSuccess
}: CalendarBookingFormProps) {
  return (
    <>
      {/* This controller will only render on mobile devices */}
      <MobileBookingController
        isOpen={isOpen}
        onClose={onClose}
        booking={booking}
        selectedDate={selectedDate}
        selectedStudio={selectedStudio}
        alertsOnly={alertsOnly}
        onSuccess={onSuccess}
      />
      
      {/* The traditional modal will only be visible on desktop */}
      <BookingModal
        isOpen={isOpen}
        onClose={onClose}
        booking={booking}
        selectedDate={selectedDate}
        selectedStudio={selectedStudio}
        alertsOnly={alertsOnly}
      />
    </>
  );
}