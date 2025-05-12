import React, { useEffect, useState } from 'react';
import { BookingType, ApiBooking, FormBookingData } from '../../types/bookings';
import { formatDateForForm, formatTimeForForm } from '../../utils/dateUtils';
import { DirectMobileForm } from './DirectMobileForm';
import { SimpleMobileForm } from './SimpleMobileForm';
import { usePcrRooms } from '../../hooks/usePcrRooms';
import { useTemplates } from '../../hooks/useTemplates';
import { useNotificationGroups } from '../../hooks/useNotificationGroups';
import { useStudios } from '../../hooks/useStudios';

// Default form data for new bookings
const defaultFormData: FormBookingData = {
  id: 0,
  title: '',
  description: '',
  studioId: 1,
  pcrRoomId: 0,
  type: 'production',
  start: new Date().toISOString(),
  end: new Date(new Date().getTime() + 60 * 60 * 1000).toISOString(),
  templateId: 0,
  notifyList: [],
  severity: 'medium',
  status: 'confirmed',
  color: '#4B83E2'
};

interface ResponsiveBookingFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FormBookingData) => void;
  booking?: ApiBooking | null;
  selectedStudio?: number | null;
  defaultStudioId?: number;
  useSimpleForm?: boolean;
}

export function ResponsiveBookingForm({
  isOpen,
  onClose,
  onSubmit,
  booking,
  selectedStudio,
  defaultStudioId,
  useSimpleForm = true // Default to simple form for mobile
}: ResponsiveBookingFormProps) {
  const { pcrRooms = [] } = usePcrRooms();
  const { templates = [] } = useTemplates();
  const { notificationGroups = [] } = useNotificationGroups();
  const { studios = [] } = useStudios();
  
  // Handle form submission wrapper function
  const handleSubmit = (data: any) => {
    // Format and validate before submitting
    const formattedData: FormBookingData = {
      id: data.id || 0,
      title: data.title,
      description: data.description || '',
      studioId: data.studioId || selectedStudio || defaultStudioId || studios[0]?.id || 1,
      pcrRoomId: data.pcrRoomId || 0,
      type: (data.type || 'production') as BookingType,
      start: data.start,
      end: data.end,
      templateId: data.templateId || 0,
      notifyList: data.notifyList || [],
      severity: data.severity || 'medium',
      status: data.status || 'confirmed',
      color: data.color || '#4B83E2'
    };
    
    onSubmit(formattedData);
  };

  // Prepare initial booking data if editing
  const initialData = booking ? {
    ...booking,
    startDate: formatDateForForm(booking.start),
    startTime: formatTimeForForm(booking.start),
    endDate: formatDateForForm(booking.end),
    endTime: formatTimeForForm(booking.end),
  } : null;
  
  // Render the appropriate form based on preference
  if (useSimpleForm) {
    return (
      <SimpleMobileForm
        isOpen={isOpen}
        onClose={onClose}
        onSubmit={handleSubmit}
        booking={booking}
        selectedStudio={selectedStudio}
        defaultStudioId={defaultStudioId}
      />
    );
  } else {
    return (
      <DirectMobileForm
        isOpen={isOpen}
        onClose={onClose}
        onSubmit={handleSubmit}
        studios={studios}
        pcrRooms={pcrRooms}
        templates={templates}
        notificationGroups={notificationGroups}
        initialData={initialData}
      />
    );
  }
}