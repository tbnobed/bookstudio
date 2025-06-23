import { useState, useEffect } from 'react';
import './simple-mobile.css';
import { BookingType, BookingSeverity, BookingStatus } from '@/types/bookings';
import { formatDateForForm, formatTimeForForm } from '@/utils/dateUtils';
import { createFacilityDate } from '@/lib/dateUtils';
import { useStudios } from '@/hooks/useStudios';
import { usePcrRooms } from '@/hooks/usePcrRooms';
import { useTemplates } from '@/hooks/useTemplates';
import { useNotificationGroups } from '@/hooks/useNotificationGroups';

interface FormBookingData {
  id: number;
  title: string;
  description: string;
  studioId: number;
  pcrRoomId: number | null;
  start: Date;
  end: Date;
  type: string;
  status: string;
  severity: string | null;
  templateId: number | null;
  notifyList: string[];
  color: string;
  studioIds: number[];
}

interface Studio {
  id: number;
  name: string;
  description: string;
  status: string;
}

interface PcrRoom {
  id: number;
  name: string;
  description: string;
  status: string;
}

interface Template {
  id: number;
  name: string;
  description: string;
  type: string;
  duration: number;
  crewRequired: any[];
  equipment: any[];
  createdBy: number;
}

interface NotificationGroup {
  id: number;
  name: string;
  email: string;
  description: string;
}

interface SimpleMobileFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FormBookingData) => void;
  booking?: any;
  selectedDate?: Date;
  selectedStudio?: number;
}

export default function SimpleMobileForm({
  isOpen,
  onClose,
  onSubmit,
  booking,
  selectedDate = new Date(),
  selectedStudio
}: SimpleMobileFormProps) {
  const [studios, setStudios] = useState<Studio[]>([]);
  const [pcrRooms, setPcrRooms] = useState<PcrRoom[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [notificationGroups, setNotificationGroups] = useState<NotificationGroup[]>([]);
  const [formData, setFormData] = useState<FormBookingData>({
    id: 0,
    title: '',
    description: '',
    studioId: selectedStudio || 0,
    pcrRoomId: null,
    start: selectedDate,
    end: new Date(selectedDate.getTime() + 60 * 60 * 1000), // 1 hour later
    type: 'production',
    status: 'draft',
    severity: 'low',
    templateId: null,
    notifyList: [],
    color: '#3b82f6',
    studioIds: []
  });

  // Log incoming booking data for debugging
  useEffect(() => {
    console.log("SimpleMobileForm - Booking data received:", {
      hasBooking: !!booking,
      bookingId: booking?.id || "none",
      bookingTitle: booking?.title || "none",
      studioId: booking?.studioId,
      startDate: booking?.start,
      endDate: booking?.end,
      notifyList: booking?.notifyList,
      selectedStudio,
      isOpen
    });
  }, [booking, selectedStudio, isOpen]);

  // Load data from API hooks (more efficient than manual fetching)
  const { data: studiosData = [] } = useStudios();
  const { data: pcrRoomsData = [] } = usePcrRooms();
  const { data: templatesData = [] } = useTemplates();
  const { data: notificationGroupsData = [] } = useNotificationGroups();
  
  // Update local state when hook data changes
  useEffect(() => {
    setStudios(studiosData);
    setPcrRooms(pcrRoomsData);
    setTemplates(templatesData);
    setNotificationGroups(notificationGroupsData);
  }, [studiosData, pcrRoomsData, templatesData, notificationGroupsData]);
  
  // Initialize form with selected date
  useEffect(() => {
    if (selectedDate && !booking) {
      setFormData(data => ({
        ...data,
        start: new Date(selectedDate),
        end: new Date(selectedDate.getTime() + 60 * 60 * 1000) // Add 1 hour
      }));
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
        id: Number(booking.id) || 0,
        title: String(booking.title || ''),
        description: String(booking.description || ''),
        studioId: Number(booking.studioId) || Number(selectedStudio) || (studios[0]?.id || 1),
        pcrRoomId: booking.pcrRoomId !== undefined ? Number(booking.pcrRoomId) : null,
        
        // Handle the date objects carefully
        // First check if we already have proper date objects in _startDate/_endDate properties
        start: booking._startDate instanceof Date ? booking._startDate : 
               (typeof booking.start === 'string' ? new Date(booking.start) : booking.start),
               
        end: booking._endDate instanceof Date ? booking._endDate : 
             (typeof booking.end === 'string' ? new Date(booking.end) : booking.end),
             
        type: booking.type || 'production',
        status: booking.status || 'confirmed',
        severity: booking.severity || null,
        templateId: Number(booking.templateId) || null,
        
        // Process notification list properly
        notifyList: Array.isArray(booking.notifyList) ? booking.notifyList : 
                   (booking.notifyList ? String(booking.notifyList).split(',').filter(Boolean) : []),
                   
        color: booking.color || '#3b82f6',
        
        // Ensure studioIds is an array of numbers
        studioIds: Array.isArray(booking.studioIds) ? booking.studioIds.map(Number).filter(Boolean) :
                  (booking.studioId ? [Number(booking.studioId)] : [])
      };
      
      // Try to force React to see this as a new object by cloning it
      console.log("SimpleMobileForm - Setting form data to:", updatedFormData);
      
      // Use a small timeout to ensure React processes state updates in order
      setTimeout(() => {
        setFormData({...updatedFormData});
      }, 100); // Increased timeout for more reliable state updates
    }
  }, [booking, selectedStudio, studios, isOpen]);  // Add isOpen to dependencies to re-run when modal opens
  
  // Determine initial studio ID
  const initialStudioId = selectedStudio || booking?.studioId || (studios[0]?.id || 0);
  
  // Fetch booking data for linked studios when editing an existing booking
  useEffect(() => {
    if (booking?.id) {
      fetch(`/api/bookings/${booking.id}/studios`)
        .then(res => res.json())
        .then(linkedStudios => {
          console.log("Fetched linked studios for booking " + booking.id + ":", linkedStudios);
          if (linkedStudios && linkedStudios.length > 0) {
            // Update the form data with these studios
            const linkedStudioIds = linkedStudios.map((studio: Studio) => studio.id.toString());
            console.log("Setting up form with linked studios:", linkedStudioIds);
            setFormData(data => ({
              ...data,
              studioIds: linkedStudioIds.map(Number)
            }));
          }
        })
        .catch(error => {
          console.error('Error fetching linked studios:', error);
        });
    }
  }, [booking]);

  // Change handlers
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Special handling for date and time fields
    if (name === 'startDate') {
      console.log(`Date change: Setting date to ${value}`);
      
      // Create a date object for Chicago timezone
      const [year, month, day] = value.split('-').map(Number);
      
      // Get current Chicago time components from the start date
      const chicagoOptions = { timeZone: 'America/Chicago' };
      const startChicagoDate = new Date(formData.start.toLocaleString('en-US', chicagoOptions));
      const hours = startChicagoDate.getHours();
      const minutes = startChicagoDate.getMinutes();
      
      // Create a new date in Chicago timezone
      const newStartDate = new Date(formData.start);
      newStartDate.setFullYear(year, month - 1, day);
      
      // Also update end date to be on the same day
      const newEndDate = new Date(formData.end);
      newEndDate.setFullYear(year, month - 1, day);
      
      setFormData(prev => ({ 
        ...prev, 
        start: newStartDate,
        end: newEndDate
      }));
      return;
    }
    
    if (name === 'startTime') {
      console.log(`Start time change: Setting time to ${value}`);
      
      // Parse the new time
      const [hours, minutes] = value.split(':').map(Number);
      
      // Get the current date components from the form data
      const currentDate = new Date(formData.start);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const day = currentDate.getDate();
      
      // Create a new date using the facility timezone function
      const newStartDate = createFacilityDate(year, month, day, hours, minutes);
      
      setFormData(prev => ({ ...prev, start: newStartDate }));
      return;
    }
    
    if (name === 'endTime') {
      console.log(`End time change: Setting time to ${value}`);
      
      // Parse the new time
      const [hours, minutes] = value.split(':').map(Number);
      
      // Get the current date components from the form data
      const currentDate = new Date(formData.end);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const day = currentDate.getDate();
      
      // Create a new date using the facility timezone function
      const newEndDate = createFacilityDate(year, month, day, hours, minutes);
      
      setFormData(prev => ({ ...prev, end: newEndDate }));
      return;
    }
    
    // Special handling for studio selection to ensure valid ID
    if (name === 'studioId') {
      const studioValue = parseInt(value);
      console.log(`Studio change: Setting to ${studioValue}`);
      setFormData(prev => ({ 
        ...prev, 
        studioId: studioValue > 0 ? studioValue : null,
        studioIds: studioValue > 0 ? [studioValue] : []
      }));
      return;
    }
    
    // Handle pcrRoomId to convert empty string to null
    if (name === 'pcrRoomId') {
      const pcrValue = value === "" ? null : parseInt(value);
      setFormData(prev => ({ 
        ...prev, 
        [name]: pcrValue 
      }));
      return;
    }
    
    // For all other fields, just update normally
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle template selection
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateId = parseInt(e.target.value);
    if (templateId === 0 || templateId === null) {
      // No template selected
      return;
    }
    
    // Find the selected template
    const selectedTemplate = templates.find(t => t.id === templateId);
    if (!selectedTemplate) return;
    
    // Use template values for the form
    setFormData(prev => {
      // Create a new date object for end time based on template duration
      const startTime = new Date(prev.start);
      const endTime = new Date(startTime);
      endTime.setMinutes(startTime.getMinutes() + (selectedTemplate.duration || 60));
      
      // Update the form with template values
      const updatedFormData = {
        ...prev,
        title: selectedTemplate.name,
        description: selectedTemplate.description || '',
        type: selectedTemplate.type || 'production',
        templateId,
        end: endTime
      };
      
      // If the template has studioIds property, use it
      if ('studioIds' in selectedTemplate && Array.isArray(selectedTemplate.studioIds)) {
        updatedFormData.studioIds = [...selectedTemplate.studioIds];
      }
      
      // If the template has status, use it
      if ('status' in selectedTemplate && selectedTemplate.status) {
        updatedFormData.status = selectedTemplate.status;
      }
      
      // If the template has severity, use it
      if ('severity' in selectedTemplate && selectedTemplate.severity) {
        updatedFormData.severity = selectedTemplate.severity;
      }
      
      // If the template has other properties, handle them here
      if ('pcrRoomId' in selectedTemplate) {
        updatedFormData.pcrRoomId = selectedTemplate.pcrRoomId;
      }
      
      if ('color' in selectedTemplate && selectedTemplate.color) {
        updatedFormData.color = selectedTemplate.color;
      }
      
      if ('notifyList' in selectedTemplate && Array.isArray(selectedTemplate.notifyList)) {
        updatedFormData.notifyList = [...selectedTemplate.notifyList];
      }
      
      return updatedFormData;
    });
  };
  
  // Handle studio selection/deselection
  const handleStudioSelect = (studioId: number) => {
    setFormData(prev => {
      const studioIds = [...(prev.studioIds || [])];
      
      // Toggle the studio - if it's already in the list, remove it, otherwise add it
      const index = studioIds.indexOf(studioId);
      if (index !== -1) {
        studioIds.splice(index, 1);
      } else {
        studioIds.push(studioId);
      }
      
      // Set the first studio as the studioId for backwards compatibility
      const primaryStudioId = studioIds.length > 0 ? studioIds[0] : 0;
      
      return { 
        ...prev, 
        studioIds,
        studioId: primaryStudioId
      };
    });
  };
  
  // Handle notification group selection
  const handleNotificationGroupSelect = (groupId: number) => {
    setFormData(prev => {
      const notifyList = [...prev.notifyList];
      const groupIdString = groupId.toString();
      
      // Toggle the group
      const index = notifyList.indexOf(groupIdString);
      if (index !== -1) {
        notifyList.splice(index, 1);
      } else {
        notifyList.push(groupIdString);
      }
      
      return { ...prev, notifyList };
    });
  };
  
  // Form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that a studio is selected
    if (!formData.studioId || formData.studioId === 0) {
      alert('Please select a studio before creating the booking');
      return;
    }
    
    // Fix studioId constraint - ensure it's never 0 (this check is redundant after validation above but kept for safety)
    const submissionData = {
      ...formData,
      studioId: formData.studioId
    };
    
    console.log('SimpleMobileForm - Final form data:', submissionData);
    onSubmit(submissionData);
  };
  
  // Auto focus first field when form opens
  useEffect(() => {
    if (isOpen) {
      // Short delay to ensure the form is fully rendered
      setTimeout(() => {
        const titleInput = document.getElementById('sm-title');
        if (titleInput) {
          titleInput.focus();
          console.log("SimpleMobileForm - Found and focused title input");
        } else {
          console.log("SimpleMobileForm - Could not find title input to focus");
        }
      }, 300);
    }
  }, [isOpen]);
  
  console.log("SimpleMobileForm - About to render form:", { isOpen, hasBooking: !!booking, formData });

  if (!isOpen) return null;
  
  return (
    <div className="simple-mobile-form-overlay" style={{ zIndex: 9999 }}>
      <div className="simple-mobile-form-container" style={{ width: '95%', maxWidth: '500px', backgroundColor: '#fff' }}>
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
        
        <form onSubmit={handleSubmit} className="simple-mobile-form" style={{ 
          overflow: 'auto', 
          maxHeight: 'calc(90vh - 60px)',
          padding: '16px',
          display: 'block',
          visibility: 'visible'
        }}>
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
              value={formData.templateId || ""}
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
              value={formData.pcrRoomId ?? ""}
              onChange={handleChange}
              className="form-select"
            >
              <option value="">None</option>
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
          {formData.type === 'alert' && (
            <div className="form-group">
              <label htmlFor="sm-severity">Severity</label>
              <select 
                id="sm-severity"
                name="severity"
                value={formData.severity || 'low'}
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