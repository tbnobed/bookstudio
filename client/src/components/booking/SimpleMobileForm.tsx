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
  selectedDate?: Date;
}

export function SimpleMobileForm({
  isOpen,
  onClose,
  onSubmit,
  booking = null,
  selectedStudio = null,
  selectedDate = new Date()
}: SimpleMobileFormProps) {
  const { studios = [] } = useStudios();
  const { pcrRooms = [] } = usePcrRooms();
  const { templates = [] } = useTemplates();
  const { notificationGroups = [] } = useNotificationGroups();
  
  // Debug logging for better trace information
  useEffect(() => {
    console.log('SimpleMobileForm - Booking data received:', {
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
    
    console.log('SimpleMobileForm - Templates loaded:', templates);
  }, [booking, templates, selectedStudio, isOpen]);
  
  // Update form dates when selectedDate changes
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
  
  // Add a dedicated effect to update form data when booking changes
  // This ensures form data is refreshed when a booking is loaded for editing
  useEffect(() => {
    if (booking) {
      console.log("SimpleMobileForm - Refreshing form data from booking:", booking);
      
      // Create a complete form data object from the booking
      // Force explicit setting of all properties to ensure nothing is missed
      const updatedFormData: FormBookingData = {
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
        templateId: booking.templateId || 0,
        notifyList: booking.notifyList || [],
        color: booking.color || '#3b82f6',
        // Make sure studioIds is properly initialized 
        studioIds: (booking as any).studioIds || (booking.studioId ? [booking.studioId] : [])
      };
      
      // Try to force React to see this as a new object by cloning it
      console.log("SimpleMobileForm - Setting form data to:", updatedFormData);
      
      // Use a small timeout to ensure React processes state updates in order
      setTimeout(() => {
        setFormData({...updatedFormData});
      }, 50);
    }
  }, [booking, selectedStudio, studios, isOpen]);  // Add isOpen to dependencies to re-run when modal opens
  
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
    start: booking ? new Date(booking.start) : new Date(selectedDate),
    end: booking ? new Date(booking.end) : new Date(new Date(selectedDate).getTime() + 3600000), // Default 1 hour later
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
    
    if (name === 'studioId' || name === 'templateId') {
      setFormData(prev => ({
        ...prev,
        [name]: parseInt(value, 10) || 0
      }));
    } else if (name === 'pcrRoomId') {
      // Parse pcrRoomId as number, but allow null (0 = null)
      const pcrRoomId = parseInt(value, 10);
      setFormData(prev => ({
        ...prev,
        pcrRoomId: pcrRoomId || null
      }));
    } else if (name === 'startDate') {
      const [currentDate, startTime] = formData.start.toISOString().split('T');
      const [endDate, endTime] = formData.end.toISOString().split('T');
      
      const newStartDateTimeStr = `${value}T${startTime}`;
      const newEndDateTimeStr = `${value}T${endTime}`;
      
      setFormData(prev => ({
        ...prev,
        start: new Date(newStartDateTimeStr),
        end: new Date(newEndDateTimeStr)
      }));
    // We no longer use endDate since we're using a single date
    } else if (name === 'startTime') {
      const currentDate = formData.start.toISOString().split('T')[0];
      const newDateTimeStr = `${currentDate}T${value}:00`;
      setFormData(prev => ({
        ...prev,
        start: new Date(newDateTimeStr),
        // Keep the end date the same, we're only modifying the start time
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
      // Clone the current studioIds array or initialize empty array
      const studioIds = [...(prev.studioIds || [])];
      const index = studioIds.indexOf(studioId);
      
      if (index === -1) {
        // Add studio if not already selected
        studioIds.push(studioId);
      } else {
        // Remove studio if already selected
        studioIds.splice(index, 1);
      }
      
      // Validate that at least one studio is selected
      // When showing validation form, we rely on the error hint to notify users
      
      return {
        ...prev,
        studioIds,
        // Always keep the first studio as primary, but allow 0 when no studios selected
        // This is important for validation to work correctly
        studioId: studioIds.length > 0 ? studioIds[0] : 0
      };
    });
  };
  
  // Handle template selection
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateId = parseInt(e.target.value, 10);
    console.log('Template dropdown change detected:', e.target.value);
    
    if (templateId > 0) {
      const selectedTemplate = templates.find(t => t.id === templateId);
      
      if (selectedTemplate) {
        console.log('SimpleMobileForm - Applying template:', selectedTemplate.name, selectedTemplate);
        
        // Apply template settings to form
        setFormData(prev => {
          // Extract studio IDs from equipment or use a default
          let templateStudioIds: number[] = [];
          
          // Process equipment based on its type
          if (selectedTemplate.equipment) {
            // Check if equipment is an array and the first item is an object with studioIds
            if (Array.isArray(selectedTemplate.equipment) && selectedTemplate.equipment.length > 0 
                && typeof selectedTemplate.equipment[0] === 'object' && selectedTemplate.equipment[0] !== null) {
              
              const equipmentItem = selectedTemplate.equipment[0];
              console.log('Template equipment item:', equipmentItem);
              
              // Extract studioIds if available
              if (equipmentItem.studioIds && Array.isArray(equipmentItem.studioIds)) {
                templateStudioIds = equipmentItem.studioIds;
                console.log('Found studioIds in equipment:', templateStudioIds);
              }
              
              // Extract PCR room ID if available
              if ('pcrRoomId' in equipmentItem) {
                prev.pcrRoomId = equipmentItem.pcrRoomId;
                console.log('Found pcrRoomId in equipment:', prev.pcrRoomId);
              }
              
              // Extract status if available
              if (equipmentItem.status && ['confirmed', 'pending', 'cancelled', 'draft'].includes(equipmentItem.status)) {
                prev.status = equipmentItem.status as BookingStatus;
                console.log('Found status in equipment:', prev.status);
              }
              
              // Extract severity if available and only apply for alert type
              if (equipmentItem.severity && ['low', 'medium', 'high', 'critical'].includes(equipmentItem.severity) && 
                  (selectedTemplate.type === 'alert' || prev.type === 'alert' as BookingType)) {
                prev.severity = equipmentItem.severity as BookingSeverity;
                console.log('Found severity in equipment for alert:', prev.severity);
              }
              
              // Extract color if available
              if (equipmentItem.color) {
                prev.color = equipmentItem.color;
                console.log('Found color in equipment:', prev.color);
              }
            } else if (typeof selectedTemplate.equipment === 'object' && selectedTemplate.equipment !== null) {
              // Handle case where equipment is a direct object
              const equipmentObj = selectedTemplate.equipment as any;
              
              if (equipmentObj.studioIds && Array.isArray(equipmentObj.studioIds)) {
                templateStudioIds = equipmentObj.studioIds;
                console.log('Found studioIds in equipment object:', templateStudioIds);
              }
              
              if ('pcrRoomId' in equipmentObj) {
                prev.pcrRoomId = equipmentObj.pcrRoomId;
                console.log('Found pcrRoomId in equipment object:', prev.pcrRoomId);
              }
              
              if (equipmentObj.status && ['confirmed', 'pending', 'cancelled', 'draft'].includes(equipmentObj.status)) {
                prev.status = equipmentObj.status as BookingStatus;
                console.log('Found status in equipment object:', prev.status);
              }
              
              // Extract severity if available and only apply for alert type
              if (equipmentObj.severity && ['low', 'medium', 'high', 'critical'].includes(equipmentObj.severity) && 
                  (selectedTemplate.type === 'alert' || prev.type === 'alert' as BookingType)) {
                prev.severity = equipmentObj.severity as BookingSeverity;
                console.log('Found severity in equipment object for alert:', prev.severity);
              }
              
              if (equipmentObj.color) {
                prev.color = equipmentObj.color;
                console.log('Found color in equipment object:', prev.color);
              }
            }
          }
          
          // Fallback: use current studio if no studio IDs in template
          if (templateStudioIds.length === 0) {
            templateStudioIds = [prev.studioId];
            console.log('No studioIds found, using current studio:', templateStudioIds);
          }
          
          // Cast template.type to BookingType if it is valid, otherwise use previous type
          const typeCast = (['recording', 'live', 'maintenance', 'other', 'production'].includes(selectedTemplate.type)
            ? selectedTemplate.type as BookingType
            : prev.type);

          // Calculate duration in minutes (this is available directly in the database)
          const templateDurationMinutes = selectedTemplate.duration || 60; // Default to 1 hour
          
          // Calculate new end time based on current start time + template duration
          const newEndTime = new Date(prev.start);
          newEndTime.setMinutes(newEndTime.getMinutes() + templateDurationMinutes);

          console.log('Template applying with values:', {
            templateId,
            name: selectedTemplate.name,
            type: typeCast,
            status: prev.status,
            severity: prev.severity,
            duration: templateDurationMinutes,
            studios: templateStudioIds,
            pcrRoomId: prev.pcrRoomId,
            color: prev.color,
            newEndTime
          });

          // Return updated form data with template values
          return {
            ...prev,
            templateId,
            title: prev.title || selectedTemplate.name, // Only use template name if title is empty
            description: selectedTemplate.description || prev.description,
            type: typeCast,
            studioId: templateStudioIds[0] || prev.studioId,
            studioIds: templateStudioIds,
            end: newEndTime // Set end time based on template duration
          };
        });
      }
    }
  };
  
  // Handle notification group selection with toggle behavior
  const handleNotificationGroupSelect = (groupId: number) => {
    const group = notificationGroups.find(g => g.id === groupId);
    
    if (group) {
      setFormData(prev => {
        // Convert to array first to ensure compatibility
        const currentNotifyList = Array.isArray(prev.notifyList) ? prev.notifyList : [];
        const groupIdStr = groupId.toString();
        
        // Check if the group is already in the list
        const isSelected = currentNotifyList.includes(groupIdStr);
        
        let notifyList;
        if (isSelected) {
          // Remove the group if already selected (toggle behavior)
          notifyList = currentNotifyList.filter(id => id !== groupIdStr);
          console.log('Removing notification group from notifyList:', groupIdStr, group.name);
        } else {
          // Add the group if not already selected
          notifyList = [...currentNotifyList, groupIdStr];
          console.log('Adding notification group to notifyList:', groupIdStr, group.name);
        }
        
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
    
    // Validate that at least one studio is selected
    if (!formData.studioIds || formData.studioIds.length === 0) {
      console.log('SimpleMobileForm - Validation failed: No studios selected');
      // Don't submit - just let the error hint display
      return;
    }
    
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
  
  console.log("SimpleMobileForm - About to render form:", { isOpen, hasBooking: !!booking, formData });

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
        
        <form onSubmit={handleSubmit} className="simple-mobile-form" style={{ overflow: 'auto', maxHeight: 'calc(90vh - 60px)' }}>
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
              onChange={(e) => {
                console.log('Template dropdown change detected:', e.target.value);
                handleTemplateChange(e);
              }}
              className="form-select"
            >
              <option value="0">No template</option>
              {templates.map(template => {
                console.log('Rendering template option:', template.id, template.name);
                return (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                );
              })}
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
            <label>Studios*</label>
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
            {(formData.studioIds || []).length === 0 && (
              <div className="error-hint">Please select at least one studio</div>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="sm-pcr">PCR Room</label>
            <select 
              id="sm-pcr"
              name="pcrRoomId"
              value={formData.pcrRoomId || 0}
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
              <label htmlFor="sm-start-date">Date*</label>
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
                <option value="rehearsal">Rehearsal</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="sm-status">Booking status*</label>
              <select 
                id="sm-status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
                className="form-select"
              >
                <option value="confirmed">Confirmed</option>
                <option value="tentative">Tentative</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          
          {/* Severity is only shown for alert type bookings */}
          {formData.type === 'alert' as BookingType && (
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
          )}
          
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
              {notificationGroups.map(group => {
                // Check if this group is in the notify list
                const isSelected = formData.notifyList.includes(group.id.toString());
                
                return (
                  <div key={group.id} className="notify-group-item">
                    <button
                      type="button"
                      onClick={() => handleNotificationGroupSelect(group.id)}
                      className={`notify-group-button ${isSelected ? 'selected' : ''}`}
                    >
                      {group.name}
                      {isSelected && ' ✓'}
                    </button>
                  </div>
                );
              })}
            </div>
            {formData.notifyList.length > 0 && (
              <div className="mt-2 text-xs text-gray-600">
                Selected groups: {formData.notifyList.map(id => {
                  const group = notificationGroups.find(g => g.id.toString() === id);
                  return group ? group.name : '';
                }).filter(Boolean).join(', ')}
              </div>
            )}
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