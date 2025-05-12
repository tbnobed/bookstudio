import React, { useState, useEffect } from 'react';
import { ApiBooking, FormBookingData } from '../../types/bookings';
import { formatDateForForm, formatTimeForForm } from '../../utils/dateUtils';
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
}

export function DirectMobileForm({
  isOpen,
  onClose,
  onSubmit,
  booking = null,
  selectedStudio = null
}: DirectMobileFormProps) {
  // Get data from hooks
  const { studios = [] } = useStudios();
  const { templates = [] } = useTemplates();
  const { pcrRooms = [] } = usePcrRooms();
  
  // Initial studio ID from props or booking
  const initialStudioId = selectedStudio || booking?.studioId || (studios[0]?.id || 0);
  
  // Create very basic form state
  const [formData, setFormData] = useState<FormBookingData>({
    id: booking?.id || 0,
    title: booking?.title || '',
    description: booking?.description || '',
    studioId: initialStudioId,
    pcrRoomId: booking?.pcrRoomId || 0, 
    start: booking ? new Date(booking.start) : new Date(),
    end: booking ? new Date(booking.end) : new Date(Date.now() + 3600000), // Default 1 hour later
    type: booking?.type || 'production',
    status: booking?.status || 'draft',
    severity: booking?.severity || 'low',
    templateId: booking?.templateId || 0,
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
            
          // Apply template settings
          return {
            ...prev,
            templateId,
            title: prev.title || selectedTemplate.name, // Only use template name if title is empty
            description: selectedTemplate.description || prev.description,
            type: selectedTemplate.type,
            studioId,
            studioIds: selectedTemplate.studioIds || [studioId],
            pcrRoomId: selectedTemplate.pcrRoomId || prev.pcrRoomId,
            status: selectedTemplate.status || prev.status,
            severity: selectedTemplate.severity || prev.severity,
            color: selectedTemplate.color || prev.color,
            notifyList: selectedTemplate.notifyList || prev.notifyList
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
              value={formData.templateId}
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