import React, { useState, useEffect } from 'react';
import { ApiBooking, FormBookingData, BookingType } from '../../types/bookings';
import { formatDateForForm, formatTimeForForm } from '../../utils/dateUtils';
import { useStudios } from '../../hooks/useStudios';
import { usePcrRooms } from '../../hooks/usePcrRooms';
import './direct-mobile.css';

// Ultra-simplified form for low-end mobile devices
interface DirectMobileFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FormBookingData) => void;
  booking?: ApiBooking | null;
  selectedStudio?: number | null;
}

export function DirectMobileForm({
  isOpen,
  onClose,
  onSubmit,
  booking = null,
  selectedStudio = null
}: DirectMobileFormProps) {
  const { studios = [] } = useStudios();
  const { pcrRooms = [] } = usePcrRooms();
  
  // Determine initial studio ID
  const initialStudioId = selectedStudio || booking?.studioId || (studios[0]?.id || 0);
  
  // Initialize form data
  const [formData, setFormData] = useState<FormBookingData>({
    id: booking?.id || 0,
    title: booking?.title || '',
    description: booking?.description || '',
    studioId: initialStudioId,
    pcrRoomId: booking?.pcrRoomId || (pcrRooms[0]?.id || 0),
    start: booking ? new Date(booking.start) : new Date(),
    end: booking ? new Date(booking.end) : new Date(Date.now() + 3600000), // Default 1 hour later
    type: booking?.type || 'production',
    status: booking?.status || 'draft',
    severity: booking?.severity || 'low',
    templateId: booking?.templateId || 0,
    notifyList: booking?.notifyList || [],
    color: booking?.color || '#3b82f6' // Default blue
  });
  
  // Handle form field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'studioId' || name === 'pcrRoomId' || name === 'templateId') {
      setFormData(prev => ({
        ...prev,
        [name]: parseInt(value, 10) || 0
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
      const currentDate = formData.start.toISOString().split('T')[0];
      const newDateTimeStr = `${currentDate}T${value}:00`;
      setFormData(prev => ({
        ...prev,
        start: new Date(newDateTimeStr)
      }));
    } else if (name === 'endTime') {
      const currentDate = formData.end.toISOString().split('T')[0];
      const newDateTimeStr = `${currentDate}T${value}:00`;
      setFormData(prev => ({
        ...prev,
        end: new Date(newDateTimeStr)
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
    console.log('DirectMobileForm - Submitting:', formData);
    onSubmit(formData);
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
          <h2>{booking ? 'Edit' : 'New'}</h2>
          <button 
            type="button" 
            className="dm-close-button"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="direct-mobile-form">
          <div className="dm-form-group">
            <label htmlFor="dm-title">Title*</label>
            <input 
              type="text"
              id="dm-title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="dm-input"
            />
          </div>
          
          <div className="dm-form-group">
            <label htmlFor="dm-description">Description</label>
            <textarea 
              id="dm-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              className="dm-textarea"
            />
          </div>
          
          <div className="dm-form-group">
            <label htmlFor="dm-studio">Studio*</label>
            <select 
              id="dm-studio"
              name="studioId"
              value={formData.studioId}
              onChange={handleChange}
              required
              className="dm-select"
            >
              {studios.map(studio => (
                <option key={studio.id} value={studio.id}>
                  {studio.name}
                </option>
              ))}
            </select>
          </div>
          
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
                className="dm-input"
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
                className="dm-input"
              />
            </div>
          </div>
          
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
                className="dm-input"
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
                className="dm-input"
              />
            </div>
          </div>
          
          <div className="dm-form-group">
            <label htmlFor="dm-type">Type*</label>
            <select 
              id="dm-type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
              className="dm-select"
            >
              <option value="production">Production</option>
              <option value="maintenance">Maintenance</option>
              <option value="private">Private</option>
              <option value="alert">Alert</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div className="dm-form-actions">
            <button type="button" className="dm-button cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="dm-button submit">
              {booking ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}