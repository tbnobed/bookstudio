import React, { useState, useEffect } from 'react';
import { ApiBooking, FormBookingData, BookingType, BookingStatus, BookingSeverity } from '../../types/bookings';
import { ApiStudio } from '../../types/studios';
import { ApiPcrRoom } from '../../types/pcr-rooms';
import { ApiTemplate } from '../../types/templates';
import { NotificationGroup } from '../../types/notifications';
import { formatDateForForm, formatTimeForForm } from '../../utils/dateUtils';
import { useStudios } from '../../hooks/useStudios';
import { usePcrRooms } from '../../hooks/usePcrRooms';
import { useTemplates } from '../../hooks/useTemplates';
import { useNotificationGroups } from '../../hooks/useNotificationGroups';
import './simple-mobile.css';

// Enhanced mobile form with more features than DirectMobileForm but still simplified
interface SimpleMobileFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FormBookingData) => void;
  booking?: ApiBooking | null;
  selectedStudio?: number | null;
}

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
  
  // Determine initial studio ID
  const initialStudioId = selectedStudio || booking?.studioId || (studios[0]?.id || 0);
  
  // Determine initial studio IDs array for multi-selection
  const initialStudioIds: number[] = [];
  
  if (booking?.studioId) {
    initialStudioIds.push(booking.studioId);
  } else if (selectedStudio) {
    initialStudioIds.push(selectedStudio);
  }
  
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
    color: booking?.color || '#3b82f6', // Default blue
    studioIds: initialStudioIds
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
  
  // Handle multi-select studios
  const handleStudioSelect = (studioId: number) => {
    setFormData(prev => {
      const studioIds = [...(prev.studioIds || [])];
      const index = studioIds.indexOf(studioId);
      
      if (index === -1) {
        studioIds.push(studioId);
      } else {
        studioIds.splice(index, 1);
      }
      
      return {
        ...prev,
        studioIds,
        studioId: studioIds[0] || 0 // Always keep the first studio as primary
      };
    });
  };
  
  // Handle template selection
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateId = parseInt(e.target.value, 10);
    
    if (templateId > 0) {
      const selectedTemplate = templates.find(t => t.id === templateId);
      
      if (selectedTemplate) {
        console.log('SimpleMobileForm - Applying template:', selectedTemplate.name);
        
        // Apply template settings to form
        setFormData(prev => {
          // Determine studio ID - use first from template if available
          const studioId = selectedTemplate.studioIds && selectedTemplate.studioIds.length > 0 
            ? selectedTemplate.studioIds[0] 
            : prev.studioId;

          // Return updated form data with template values
          return {
            ...prev,
            templateId,
            title: prev.title || selectedTemplate.name, // Only use template name if title is empty
            description: selectedTemplate.description || prev.description,
            type: selectedTemplate.type,
            studioId: studioId,
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
  
  // Handle notification group selection
  const handleNotificationGroupSelect = (groupId: number) => {
    const group = notificationGroups.find(g => g.id === groupId);
    
    if (group) {
      // Add all emails from the group to the notify list
      setFormData(prev => {
        const notifyList = [...new Set([...prev.notifyList, ...group.emails])];
        return {
          ...prev,
          notifyList
        };
      });
    }
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('SimpleMobileForm - Submitting:', formData);
    onSubmit(formData);
  };
  
  // Auto focus first field when form opens
  useEffect(() => {
    if (isOpen) {
      const titleInput = document.getElementById('sm-title');
      if (titleInput) {
        titleInput.focus();
      }
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return (
    <div className="simple-mobile-form-overlay">
      <div className="simple-mobile-form-container">
        <div className="simple-mobile-form-header">
          <h2>{booking ? 'Edit Booking' : 'New Booking'}</h2>
          <button 
            type="button" 
            className="close-button"
            onClick={onClose}
            aria-label="Close form"
          >
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="simple-mobile-form">
          <div className="form-group">
            <label htmlFor="sm-title">Title*</label>
            <input 
              type="text"
              id="sm-title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="form-input"
              placeholder="Add booking title"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="sm-template">Template</label>
            <select 
              id="sm-template"
              name="templateId"
              value={formData.templateId}
              onChange={handleTemplateChange}
              className="form-select"
            >
              <option value="0">No template</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="sm-description">Description</label>
            <textarea 
              id="sm-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="form-textarea"
              placeholder="Add details about this booking"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="sm-studio">Primary Studio*</label>
            <select 
              id="sm-studio"
              name="studioId"
              value={formData.studioId}
              onChange={handleChange}
              required
              className="form-select"
            >
              {studios.map(studio => (
                <option key={studio.id} value={studio.id}>
                  {studio.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label>Additional Studios</label>
            <div className="studio-multi-select">
              {studios.map(studio => (
                <div key={studio.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    id={`studio-${studio.id}`}
                    checked={(formData.studioIds || []).includes(studio.id)}
                    onChange={() => handleStudioSelect(studio.id)}
                  />
                  <label htmlFor={`studio-${studio.id}`}>{studio.name}</label>
                </div>
              ))}
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="sm-pcr">PCR Room</label>
            <select 
              id="sm-pcr"
              name="pcrRoomId"
              value={formData.pcrRoomId}
              onChange={handleChange}
              className="form-select"
            >
              <option value="0">None</option>
              {pcrRooms.map(pcr => (
                <option key={pcr.id} value={pcr.id}>
                  {pcr.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="sm-start-date">Start Date*</label>
              <input 
                type="date"
                id="sm-start-date"
                name="startDate"
                value={formatDateForForm(formData.start)}
                onChange={handleChange}
                required
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="sm-start-time">Start Time*</label>
              <input 
                type="time"
                id="sm-start-time"
                name="startTime"
                value={formatTimeForForm(formData.start)}
                onChange={handleChange}
                required
                className="form-input"
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="sm-end-date">End Date*</label>
              <input 
                type="date"
                id="sm-end-date"
                name="endDate"
                value={formatDateForForm(formData.end)}
                onChange={handleChange}
                required
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="sm-end-time">End Time*</label>
              <input 
                type="time"
                id="sm-end-time"
                name="endTime"
                value={formatTimeForForm(formData.end)}
                onChange={handleChange}
                required
                className="form-input"
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="sm-type">Booking Type*</label>
              <select 
                id="sm-type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
                className="form-select"
              >
                <option value="production">Production</option>
                <option value="maintenance">Maintenance</option>
                <option value="private">Private</option>
                <option value="alert">Alert</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="sm-status">Status*</label>
              <select 
                id="sm-status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
                className="form-select"
              >
                <option value="draft">Draft</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="sm-severity">Severity</label>
            <select 
              id="sm-severity"
              name="severity"
              value={formData.severity}
              onChange={handleChange}
              className="form-select"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="sm-color">Color</label>
            <input 
              type="color"
              id="sm-color"
              name="color"
              value={formData.color}
              onChange={handleChange}
              className="form-color"
            />
          </div>
          
          <div className="form-group">
            <label>Notify Groups</label>
            <div className="notify-group-select">
              {notificationGroups.map(group => (
                <div key={group.id} className="notify-group-item">
                  <button
                    type="button"
                    onClick={() => handleNotificationGroupSelect(group.id)}
                    className="notify-group-button"
                  >
                    {group.name}
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          <div className="form-actions">
            <button type="button" className="cancel-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-button">
              {booking ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}