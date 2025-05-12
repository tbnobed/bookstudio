import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useStudios } from '@/hooks/useStudios';
import { FormBookingData, ApiBooking } from '../../types/bookings';
import './direct-mobile.css';

interface DirectMobileFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FormBookingData) => void;
  booking?: ApiBooking | null;
  selectedStudio?: number | null;
}

/**
 * An ultra-simplified booking form for very low-end devices or small screens
 * This form has minimal features and is designed to be as lightweight as possible
 */
export function DirectMobileForm({
  isOpen,
  onClose,
  onSubmit,
  booking = null,
  selectedStudio = null
}: DirectMobileFormProps) {
  const { studios = [] } = useStudios();
  
  // Form state with bare minimum required fields
  const [formData, setFormData] = useState<FormBookingData>({
    id: booking?.id || 0,
    title: booking?.title || '',
    description: booking?.description || '',
    studioId: selectedStudio || booking?.studioId || (studios[0]?.id || 0),
    pcrRoomId: booking?.pcrRoomId || 0,
    type: booking?.type || 'production',
    start: booking?.start ? new Date(booking.start) : new Date(),
    end: booking?.end ? new Date(booking.end) : new Date(Date.now() + 60 * 60 * 1000), // Default 1 hour
    templateId: booking?.templateId || 0,
    status: booking?.status || 'confirmed',
    notifyList: booking?.notifyList || [],
    severity: booking?.severity || 'medium',
    color: booking?.color || '#4B83E2'
  });
  
  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'start' || name === 'end') {
      // Handle date/time inputs
      const [date, time] = value.split('T');
      const newDate = new Date(`${date}T${time || '00:00'}`);
      setFormData(prev => ({ ...prev, [name]: newDate }));
    } else {
      // Handle all other inputs
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };
  
  // Format dates for display
  const formatDateTimeLocal = (date: Date) => {
    return format(date, "yyyy-MM-dd'T'HH:mm");
  };
  
  // If not open, don't render anything
  if (!isOpen) return null;
  
  return (
    <div className="direct-mobile-overlay">
      <div className="direct-mobile-container">
        <div className="direct-mobile-header">
          <h2 className="direct-mobile-title">
            {booking && booking.id > 0 ? 'Edit Booking' : 'New Booking'}
          </h2>
          <button 
            type="button" 
            className="direct-mobile-close-btn"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="direct-mobile-form">
          {/* Title */}
          <div className="direct-mobile-form-group">
            <label htmlFor="title">Title:</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Enter booking title"
              required
              className="direct-mobile-input"
            />
          </div>
          
          {/* Studio selection */}
          <div className="direct-mobile-form-group">
            <label htmlFor="studioId">Studio:</label>
            <select
              id="studioId"
              name="studioId"
              value={formData.studioId || ''}
              onChange={handleChange}
              className="direct-mobile-select"
              required
            >
              <option value="">Select a studio</option>
              {studios.map(studio => (
                <option key={studio.id} value={studio.id}>
                  {studio.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Start Date/Time */}
          <div className="direct-mobile-form-group">
            <label htmlFor="start">Start:</label>
            <input
              type="datetime-local"
              id="start"
              name="start"
              value={formatDateTimeLocal(formData.start)}
              onChange={handleChange}
              className="direct-mobile-input"
              required
            />
          </div>
          
          {/* End Date/Time */}
          <div className="direct-mobile-form-group">
            <label htmlFor="end">End:</label>
            <input
              type="datetime-local"
              id="end"
              name="end"
              value={formatDateTimeLocal(formData.end)}
              onChange={handleChange}
              className="direct-mobile-input"
              required
            />
          </div>
          
          {/* Description */}
          <div className="direct-mobile-form-group">
            <label htmlFor="description">Description:</label>
            <textarea
              id="description"
              name="description"
              value={formData.description || ''}
              onChange={handleChange}
              placeholder="Enter booking details"
              rows={2}
              className="direct-mobile-textarea"
            />
          </div>
          
          {/* Type */}
          <div className="direct-mobile-form-group">
            <label htmlFor="type">Type:</label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="direct-mobile-select"
            >
              <option value="production">Production</option>
              <option value="maintenance">Maintenance</option>
              <option value="private">Private</option>
              <option value="alert">Alert/Notification</option>
            </select>
          </div>
          
          {/* Action Buttons */}
          <div className="direct-mobile-actions">
            <button
              type="button"
              onClick={onClose}
              className="direct-mobile-button direct-mobile-button-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="direct-mobile-button direct-mobile-button-submit"
            >
              {booking && booking.id > 0 ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}