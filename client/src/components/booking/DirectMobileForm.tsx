import React, { useState, useEffect } from 'react';
import { ApiBooking, FormBookingData, BookingType, BookingStatus, BookingSeverity } from '../../types/bookings';
import { formatDateForForm, formatTimeForForm } from '../../utils/dateUtils';
import { createFacilityDate } from '../../lib/dateUtils';
import { useTemplates } from '../../hooks/useTemplates';
import { useStudios } from '../../hooks/useStudios';
import { usePcrRooms } from '../../hooks/usePcrRooms';
import './direct-mobile.css';

// Ultra-lightweight form for low-end mobile devices with minimal features
interface DirectMobileFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FormBookingData) => void;
  booking?: ApiBooking | null;
  selectedStudio?: number | null;
  selectedDate?: Date;
}

export function DirectMobileForm({
  isOpen,
  onClose,
  onSubmit,
  booking = null,
  selectedStudio = null,
  selectedDate = new Date()
}: DirectMobileFormProps) {
  // Get data from hooks
  const { studios = [] } = useStudios();
  const { templates = [] } = useTemplates();
  const { pcrRooms = [] } = usePcrRooms();
  
  // Initial studio ID from props or booking
  const initialStudioId = selectedStudio || booking?.studioId || (studios[0]?.id || 1);
  
  // Debug logging for tracing booking data issues
  useEffect(() => {
    console.log('DirectMobileForm - Booking data received:', {
      hasBooking: !!booking,
      bookingId: booking?.id || 'none',
      bookingTitle: booking?.title || 'none',
      studioId: booking?.studioId,
      startDate: booking?.start,
      endDate: booking?.end,
      notifyList: booking?.notifyList,
      selectedStudio: selectedStudio,
      isOpen: isOpen
    });
  }, [booking, selectedStudio, isOpen]);
  
  // Add a dedicated effect to update form data when booking changes or modal opens
  useEffect(() => {
    if (booking && isOpen) {
      console.log("DirectMobileForm - Refreshing form data from booking:", booking);
      
      // Create a complete form data object from the booking with explicit properties
      const updatedFormData = {
        id: booking.id || 0,
        title: booking.title || '',
        description: booking.description || '',
        studioId: booking.studioId || (selectedStudio || studios[0]?.id || 0),
        pcrRoomId: booking.pcrRoomId || null,
        // Access the Date objects we stored from BookingFormSelector if they exist
        // Otherwise fall back to converting the strings
        start: (booking as any)._startDate || new Date(booking.start),
        end: (booking as any)._endDate || new Date(booking.end),
        type: booking.type || 'production',
        status: booking.status || 'confirmed',
        severity: booking.severity || null,
        templateId: booking.templateId || null,
        notifyList: booking.notifyList || [],
        color: booking.color || '#3b82f6',
        // Make sure studioIds is properly initialized
        studioIds: (booking as any).studioIds || (booking.studioId ? [booking.studioId] : [])
      };
      
      // Force React to see this as a new object by using setTimeout
      console.log("DirectMobileForm - Setting form data to:", updatedFormData);
      
      setTimeout(() => {
        setFormData({...updatedFormData});
      }, 50);
    }
  }, [booking, selectedStudio, studios, isOpen, pcrRooms]);
  
  // Update dates when selectedDate changes
  useEffect(() => {
    if (!booking) {
      // Only update if this is a new booking (not editing)
      setFormData(prev => {
        const newStart = new Date(selectedDate);
        const newEnd = new Date(new Date(selectedDate).getTime() + 3600000); // 1 hour later
        return {
          ...prev,
          start: newStart,
          end: newEnd
        };
      });
    }
  }, [selectedDate, booking]);
  
  // Add dedicated effect to update form data when booking changes
  // This ensures form data is refreshed when a booking is loaded for editing
  useEffect(() => {
    if (booking) {
      console.log("DirectMobileForm - Refreshing form data from booking:", booking);
      
      // Create a complete form data object from the booking
      const updatedFormData = {
        id: booking.id || 0,
        title: booking.title || '',
        description: booking.description || '',
        studioId: booking.studioId || (selectedStudio || studios[0]?.id || 0),
        pcrRoomId: booking.pcrRoomId || null,
        start: new Date(booking.start),
        end: new Date(booking.end),
        type: booking.type || 'production',
        status: booking.status || 'confirmed',
        severity: booking.severity || null,
        templateId: booking.templateId || null,
        notifyList: booking.notifyList || [],
        color: booking.color || '#3b82f6',
        studioIds: booking.studioIds || (booking.studioId ? [booking.studioId] : [])
      };
      
      console.log("DirectMobileForm - Setting form data to:", updatedFormData);
      setFormData(updatedFormData);
    }
  }, [booking, selectedStudio, studios]);
  
  // Create very basic form state
  const [formData, setFormData] = useState<FormBookingData>({
    id: booking?.id || 0,
    title: booking?.title || '',
    description: booking?.description || '',
    studioId: selectedStudio || (studios[0]?.id || 1),
    pcrRoomId: booking?.pcrRoomId || null, 
    start: booking ? new Date(booking.start) : new Date(selectedDate),
    end: booking ? new Date(booking.end) : new Date(new Date(selectedDate).getTime() + 3600000), // Default 1 hour later
    type: booking?.type || 'production',
    status: booking?.status || 'draft',
    severity: booking?.severity || 'low',
    templateId: booking?.templateId || null,
    notifyList: booking?.notifyList || [],
    color: booking?.color || '#3b82f6', // Default blue
    studioIds: initialStudioId ? [initialStudioId] : []
  });
  
  // Handle template selection
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateId = parseInt(e.target.value, 10);
    
    if (templateId > 0) {
      const selectedTemplate = templates.find(t => t.id === templateId);
      
      if (selectedTemplate) {
        console.log('DirectMobileForm - Applying template:', selectedTemplate.name);
        
        // Apply template settings to form
        setFormData(prev => {
          // Select the first studio from template if available, otherwise keep current
          const studioId = selectedTemplate.studioIds && selectedTemplate.studioIds.length > 0 
            ? selectedTemplate.studioIds[0] 
            : prev.studioId;
          
          // Cast template.type to BookingType if it is valid, otherwise use previous type
          const typeCast = (['recording', 'live', 'maintenance', 'other', 'production'].includes(selectedTemplate.type)
            ? selectedTemplate.type as BookingType
            : prev.type);
          
          // Cast template.status to BookingStatus if it is valid, otherwise use previous status
          const statusCast = (['confirmed', 'pending', 'cancelled', 'draft'].includes(selectedTemplate.status)
            ? selectedTemplate.status as BookingStatus
            : prev.status);
          
          // Cast template.severity to BookingSeverity if it is valid, otherwise use previous severity
          const severityCast = (['low', 'medium', 'high', 'critical'].includes(selectedTemplate.severity)
            ? selectedTemplate.severity as BookingSeverity
            : prev.severity);
            
          // Calculate duration in minutes
          const templateDurationMinutes = selectedTemplate.duration || 60; // Default to 1 hour
          
          // Calculate new end time based on current start time + template duration
          const newEndTime = new Date(prev.start);
          newEndTime.setMinutes(newEndTime.getMinutes() + templateDurationMinutes);
          
          console.log('Template applying with values:', {
            templateId,
            name: selectedTemplate.name,
            type: typeCast,
            status: statusCast,
            severity: severityCast,
            duration: templateDurationMinutes,
            studios: selectedTemplate.studioIds || [studioId]
          });
            
          // Apply template settings
          return {
            ...prev,
            templateId,
            title: prev.title || selectedTemplate.name, // Only use template name if title is empty
            description: selectedTemplate.description || prev.description,
            type: typeCast,
            studioId,
            studioIds: selectedTemplate.studioIds || [studioId],
            pcrRoomId: selectedTemplate.pcrRoomId || prev.pcrRoomId,
            status: statusCast,
            severity: severityCast,
            color: selectedTemplate.color || prev.color,
            notifyList: selectedTemplate.notifyList || prev.notifyList,
            end: newEndTime // Set end time based on template duration
          };
        });
      }
    }
  };
  
  // Handle form field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'templateId') {
      if (e.target instanceof HTMLSelectElement) {
        handleTemplateChange(e as React.ChangeEvent<HTMLSelectElement>);
      }
    } else if (name === 'studioId') {
      const studioId = parseInt(value, 10) || 0;
      setFormData(prev => ({
        ...prev,
        studioId,
        studioIds: studioId ? [studioId] : []
      }));
    } else if (name === 'pcrRoomId') {
      // Parse pcrRoomId as number, but allow null (empty = null)
      const pcrRoomId = value === "" ? null : parseInt(value, 10);
      setFormData(prev => ({
        ...prev,
        pcrRoomId: pcrRoomId
      }));
    } else if (name === 'startDate') {
      const [currentDate, currentTime] = formData.start.toISOString().split('T');
      const newDateTimeStr = `${value}T${currentTime}`;
      setFormData(prev => ({
        ...prev,
        start: new Date(newDateTimeStr)
      }));
    } else if (name === 'endDate') {
      const [currentDate, currentTime] = formData.end.toISOString().split('T');
      const newDateTimeStr = `${value}T${currentTime}`;
      setFormData(prev => ({
        ...prev,
        end: new Date(newDateTimeStr)
      }));
    } else if (name === 'startTime') {
      // Parse startTime and update the start date in Chicago timezone
      const [hours, minutes] = value.split(':').map(Number);
      const currentDate = new Date(formData.start);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const day = currentDate.getDate();
      
      // Create a new date using the facility timezone function
      const newStartDate = createFacilityDate(year, month, day, hours, minutes);
      
      setFormData(prev => ({
        ...prev,
        start: newStartDate
      }));
    } else if (name === 'endTime') {
      // Parse endTime and update the end date in Chicago timezone
      const [hours, minutes] = value.split(':').map(Number);
      const currentDate = new Date(formData.end);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const day = currentDate.getDate();
      
      // Create a new date using the facility timezone function
      const newEndDate = createFacilityDate(year, month, day, hours, minutes);
      
      setFormData(prev => ({
        ...prev,
        end: newEndDate
      }));
    } else if (name === 'studioId') {
      // Handle studio selection specifically to ensure valid ID
      const studioValue = parseInt(value);
      console.log(`DirectMobileForm - Studio change: Setting to ${studioValue}`);
      setFormData(prev => ({
        ...prev,
        studioId: studioValue > 0 ? studioValue : null
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that a studio is selected
    if (!formData.studioId || formData.studioId === 0) {
      alert('Please select a studio before creating the booking');
      return;
    }
    
    // Fix studioId constraint - ensure it's never 0
    const submissionData = {
      ...formData,
      studioId: formData.studioId === 0 ? null : formData.studioId
    };
    
    console.log('DirectMobileForm - Submitting:', submissionData);
    onSubmit(submissionData);
  };
  
  // Auto focus first field when form opens
  useEffect(() => {
    if (isOpen) {
      const titleInput = document.getElementById('dm-title');
      if (titleInput) {
        titleInput.focus();
      }
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return (
    <div className="direct-mobile-overlay">
      <div className="direct-mobile-container">
        <div className="direct-mobile-header">
          <h2>{booking ? 'Edit Booking' : 'New Booking'}</h2>
          <button 
            type="button" 
            className="dm-close-button"
            onClick={onClose}
            aria-label="Close form"
          >
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="direct-mobile-form">
          {/* Title Field (required) */}
          <div className="dm-form-group">
            <label htmlFor="dm-title">Title*</label>
            <input 
              type="text"
              id="dm-title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="dm-form-input"
              placeholder="Add booking title"
            />
          </div>

          {/* Template Selection */}
          <div className="dm-form-group">
            <label htmlFor="dm-template">Template</label>
            <select 
              id="dm-template"
              name="templateId"
              value={formData.templateId || ""}
              onChange={handleChange}
              className="dm-form-select"
            >
              <option value="0">No template</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Studio Selection (required) */}
          <div className="dm-form-group">
            <label htmlFor="dm-studio">Studio*</label>
            <select 
              id="dm-studio"
              name="studioId"
              value={formData.studioId}
              onChange={handleChange}
              required
              className="dm-form-select"
            >
              <option value="">Select Studio</option>
              <option value="1">Studio A</option>
              <option value="2">Studio B</option>
              <option value="3">Studio F</option>
              <option value="4">Studio Z</option>
              <option value="5">Studio X</option>
              <option value="6">Studio E</option>
              <option value="7">Studio Y</option>
            </select>
          </div>
          
          {/* Start Date and Time */}
          <div className="dm-form-row">
            <div className="dm-form-group">
              <label htmlFor="dm-start-date">Start Date*</label>
              <input 
                type="date"
                id="dm-start-date"
                name="startDate"
                value={formatDateForForm(formData.start)}
                onChange={handleChange}
                required
                className="dm-form-input"
              />
            </div>
            
            <div className="dm-form-group">
              <label htmlFor="dm-start-time">Start Time*</label>
              <input 
                type="time"
                id="dm-start-time"
                name="startTime"
                value={formatTimeForForm(formData.start)}
                onChange={handleChange}
                required
                className="dm-form-input"
              />
            </div>
          </div>
          
          {/* End Date and Time */}
          <div className="dm-form-row">
            <div className="dm-form-group">
              <label htmlFor="dm-end-date">End Date*</label>
              <input 
                type="date"
                id="dm-end-date"
                name="endDate"
                value={formatDateForForm(formData.end)}
                onChange={handleChange}
                required
                className="dm-form-input"
              />
            </div>
            
            <div className="dm-form-group">
              <label htmlFor="dm-end-time">End Time*</label>
              <input 
                type="time"
                id="dm-end-time"
                name="endTime"
                value={formatTimeForForm(formData.end)}
                onChange={handleChange}
                required
                className="dm-form-input"
              />
            </div>
          </div>
          
          {/* Booking Type */}
          <div className="dm-form-group">
            <label htmlFor="dm-type">Type*</label>
            <select 
              id="dm-type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
              className="dm-form-select"
            >
              <option value="production">Production</option>
              <option value="maintenance">Maintenance</option>
              <option value="private">Private</option>
              <option value="alert">Alert</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          {/* Description Field (optional) */}
          <div className="dm-form-group">
            <label htmlFor="dm-description">Description</label>
            <textarea 
              id="dm-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              className="dm-form-textarea"
              placeholder="Add details about this booking"
            />
          </div>
          
          <div className="dm-form-actions">
            <button type="button" className="dm-cancel-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="dm-submit-button">
              {booking ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}