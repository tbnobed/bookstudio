import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useStudios } from '@/hooks/useStudios';
import { usePcrRooms } from '@/hooks/usePcrRooms';
import { useTemplates } from '@/hooks/useTemplates';
import { useNotificationGroups } from '@/hooks/useNotificationGroups';
import { FormBookingData, ApiBooking } from '../../types/bookings';
import { formatDateForForm } from '../../utils/dateUtils';
import './simple-mobile.css';

interface SimpleMobileFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FormBookingData) => void;
  booking?: ApiBooking | null;
  selectedStudio?: number | null;
}

/**
 * A simplified mobile booking form that uses native inputs instead of shadcn components
 * This version is optimized for medium-sized mobile devices with decent screens
 */
export function SimpleMobileForm({
  isOpen,
  onClose,
  onSubmit,
  booking = null,
  selectedStudio = null
}: SimpleMobileFormProps) {
  const { studios = [] } = useStudios();
  const { pcrRooms = [] } = usePcrRooms();
  const { templates = [] } = useTemplates();
  const { notificationGroups = [] } = useNotificationGroups();
  
  // Form state
  const [formData, setFormData] = useState<FormBookingData>({
    id: booking?.id || 0,
    title: booking?.title || '',
    description: booking?.description || '',
    studioId: selectedStudio || booking?.studioId || (studios[0]?.id || 0),
    pcrRoomId: booking?.pcrRoomId || 0,
    type: booking?.type || 'production',
    start: booking?.start ? new Date(booking.start) : new Date(),
    end: booking?.end ? new Date(booking.end) : new Date(Date.now() + 60 * 60 * 1000), // Default 1 hour duration
    templateId: booking?.templateId || 0,
    status: booking?.status || 'confirmed',
    notifyList: booking?.notifyList || [],
    severity: booking?.severity || 'medium',
    color: booking?.color || '#4B83E2'
  });
  
  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checkbox = e.target as HTMLInputElement;
      
      // Handle checkboxes for notification groups
      if (name.startsWith('notify_')) {
        const groupId = name.replace('notify_', '');
        
        setFormData(prev => {
          const newNotifyList = checkbox.checked
            ? [...prev.notifyList, groupId]
            : prev.notifyList.filter(id => id !== groupId);
          
          return { ...prev, notifyList: newNotifyList };
        });
      }
    } else if (name === 'start' || name === 'end') {
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
  
  // Format dates for display in form inputs
  const formatDateTimeLocal = (date: Date) => {
    return format(date, "yyyy-MM-dd'T'HH:mm");
  };
  
  // If not open, don't render anything
  if (!isOpen) return null;
  
  return (
    <div className="simple-mobile-overlay">
      <div className="simple-mobile-container">
        <div className="simple-mobile-header">
          <h2 className="simple-mobile-title">
            {booking && booking.id > 0 ? 'Edit Booking' : 'New Booking'}
          </h2>
          <button 
            type="button" 
            className="simple-mobile-close-btn"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="simple-mobile-form">
          {/* Title */}
          <div className="simple-mobile-form-group">
            <label htmlFor="title">Title:</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Enter booking title"
              required
              className="simple-mobile-input"
            />
          </div>
          
          {/* Type */}
          <div className="simple-mobile-form-group">
            <label htmlFor="type">Type:</label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="simple-mobile-select"
            >
              <option value="production">Production</option>
              <option value="maintenance">Maintenance</option>
              <option value="private">Private</option>
              <option value="alert">Alert/Notification</option>
            </select>
          </div>
          
          {/* Studio selection */}
          <div className="simple-mobile-form-group">
            <label htmlFor="studioId">Studio:</label>
            <select
              id="studioId"
              name="studioId"
              value={formData.studioId || ''}
              onChange={handleChange}
              className="simple-mobile-select"
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
          
          {/* PCR Room selection */}
          <div className="simple-mobile-form-group">
            <label htmlFor="pcrRoomId">PCR Room:</label>
            <select
              id="pcrRoomId"
              name="pcrRoomId"
              value={formData.pcrRoomId || ''}
              onChange={handleChange}
              className="simple-mobile-select"
            >
              <option value="0">None</option>
              {pcrRooms.map(room => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Template selection */}
          <div className="simple-mobile-form-group">
            <label htmlFor="templateId">Template:</label>
            <select
              id="templateId"
              name="templateId"
              value={formData.templateId || ''}
              onChange={handleChange}
              className="simple-mobile-select"
            >
              <option value="0">None</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Start Date/Time */}
          <div className="simple-mobile-form-group">
            <label htmlFor="start">Start:</label>
            <input
              type="datetime-local"
              id="start"
              name="start"
              value={formatDateTimeLocal(formData.start)}
              onChange={handleChange}
              className="simple-mobile-input"
              required
            />
          </div>
          
          {/* End Date/Time */}
          <div className="simple-mobile-form-group">
            <label htmlFor="end">End:</label>
            <input
              type="datetime-local"
              id="end"
              name="end"
              value={formatDateTimeLocal(formData.end)}
              onChange={handleChange}
              className="simple-mobile-input"
              required
            />
          </div>
          
          {/* Status */}
          <div className="simple-mobile-form-group">
            <label htmlFor="status">Status:</label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="simple-mobile-select"
            >
              <option value="draft">Draft</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          
          {/* Severity (for maintenance/alerts) */}
          {formData.type === 'maintenance' || formData.type === 'alert' ? (
            <div className="simple-mobile-form-group">
              <label htmlFor="severity">Severity:</label>
              <select
                id="severity"
                name="severity"
                value={formData.severity}
                onChange={handleChange}
                className="simple-mobile-select"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          ) : null}
          
          {/* Description */}
          <div className="simple-mobile-form-group">
            <label htmlFor="description">Description:</label>
            <textarea
              id="description"
              name="description"
              value={formData.description || ''}
              onChange={handleChange}
              placeholder="Enter booking details"
              rows={3}
              className="simple-mobile-textarea"
            />
          </div>
          
          {/* Notification Groups */}
          <div className="simple-mobile-form-group">
            <label>Notify:</label>
            <div className="simple-mobile-checkbox-grid">
              {notificationGroups.map(group => (
                <div key={group.id} className="simple-mobile-checkbox-item">
                  <input
                    type="checkbox"
                    id={`notify_${group.id}`}
                    name={`notify_${group.id}`}
                    checked={formData.notifyList.includes(group.id.toString())}
                    onChange={handleChange}
                    className="simple-mobile-checkbox"
                  />
                  <label htmlFor={`notify_${group.id}`} className="simple-mobile-checkbox-label">
                    {group.name}
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          {/* Color Selection */}
          <div className="simple-mobile-form-group">
            <label htmlFor="color">Color:</label>
            <div className="simple-mobile-color-selector">
              <input
                type="color"
                id="color"
                name="color"
                value={formData.color}
                onChange={handleChange}
                className="simple-mobile-color-input"
              />
              <span className="simple-mobile-color-preview" style={{ backgroundColor: formData.color }}></span>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="simple-mobile-actions">
            <button
              type="button"
              onClick={onClose}
              className="simple-mobile-button simple-mobile-button-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="simple-mobile-button simple-mobile-button-submit"
            >
              {booking && booking.id > 0 ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}