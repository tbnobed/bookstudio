import { useState, useEffect } from 'react';
import './simple-mobile.css';
import { BookingType, BookingSeverity, BookingStatus } from '@/types/bookings';
import { formatDateForForm, formatTimeForForm } from '@/utils/dateUtils';
import { createFacilityDate, generateTimeOptions, formatTime } from '@/lib/dateUtils';
import { useStudios } from '@/hooks/useStudios';
import { usePcrRooms } from '@/hooks/usePcrRooms';
import { useTemplates } from '@/hooks/useTemplates';
import { useNotificationGroups } from '@/hooks/useNotificationGroups';
import { useStudioBookings } from '@/hooks/useStudioBookings';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { NotificationGroup } from '@/types/notifications';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FormBookingData {
  id: number;
  title: string;
  description: string;
  studioId: number | null;
  pcrRoomId: number | null;
  start: Date | string;
  end: Date | string;
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
  description: string | null;
  status: string;
}

interface PcrRoom {
  id: number;
  name: string;
  description: string | null;
  status: string;
}

interface Template {
  id: number;
  name: string;
  description?: string | null;
  type: string;
  duration: number;
  startTime?: string | null;
  endTime?: string | null;
  studioIds?: number[] | null;
  pcrRoomId?: number | null;
  status?: string | null;
  color?: string | null;
  notifyList?: string[] | null;
  createdBy: number;
}

// Use NotificationGroup from shared types instead of local interface

interface SimpleMobileFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FormBookingData) => void;
  booking?: any;
  selectedDate?: Date;
  selectedStudio?: number;
  alertMode?: boolean;
}

export default function SimpleMobileForm({
  isOpen,
  onClose,
  onSubmit,
  booking,
  selectedDate = new Date(),
  selectedStudio,
  alertMode = false
}: SimpleMobileFormProps) {
  const { toast } = useToast();
  const { deleteBooking } = useStudioBookings();
  const [studios, setStudios] = useState<Studio[]>([]);
  const [pcrRooms, setPcrRooms] = useState<PcrRoom[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [notificationGroups, setNotificationGroups] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    id: 0,
    title: '',
    description: '',
    studioId: selectedStudio || 0,
    pcrRoomId: null,
    date: formatDateForForm(selectedDate),
    startTime: '9:00am',
    endTime: '10:00am',
    type: alertMode ? 'alert' : 'production',
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
  const { studios: studiosData = [] } = useStudios();
  const { pcrRooms: pcrRoomsData = [] } = usePcrRooms();
  const { templates: templatesData = [] } = useTemplates();
  const { notificationGroups: notificationGroupsData = [] } = useNotificationGroups();
  
  // Update local state when hook data changes (only when data actually changes)
  useEffect(() => {
    if (studiosData.length > 0) setStudios(studiosData);
  }, [studiosData]);
  
  useEffect(() => {
    if (pcrRoomsData.length > 0) setPcrRooms(pcrRoomsData);
  }, [pcrRoomsData]);
  
  useEffect(() => {
    if (templatesData.length > 0) setTemplates(templatesData);
  }, [templatesData]);
  
  useEffect(() => {
    if (notificationGroupsData.length > 0) setNotificationGroups(notificationGroupsData);
  }, [notificationGroupsData]);
  
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
        studioId: booking.studioId || selectedStudio || (studios[0]?.id || null),
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
        templateId: booking.templateId || null,
        
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
      
      // Validate that start time is not later than end time
      if (newStartDate >= formData.end) {
        alert('Start time cannot be later than or equal to end time. Please select an earlier time.');
        return; // Don't update the form data
      }
      
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
      
      // Validate that end time is not earlier than start time
      if (newEndDate <= formData.start) {
        alert('End time cannot be earlier than or equal to start time. Please select a later time.');
        return; // Don't update the form data
      }
      
      setFormData(prev => ({ ...prev, end: newEndDate }));
      return;
    }
    
    // Special handling for studio selection to ensure valid ID
    if (name === 'studioId') {
      const studioValue = parseInt(value);
      console.log(`Studio change: Setting to ${studioValue}`);
      setFormData(prev => {
        const currentStudioIds = prev.studioIds || [];
        
        // If selecting a studio and it's not already in the list, add it
        if (studioValue > 0) {
          const updatedStudioIds = currentStudioIds.includes(studioValue) 
            ? currentStudioIds 
            : [...currentStudioIds, studioValue];
            
          return {
            ...prev, 
            studioId: studioValue,
            studioIds: updatedStudioIds
          };
        } else {
          // If clearing selection, keep existing studioIds but clear primary studioId
          return {
            ...prev,
            studioId: null,
            studioIds: currentStudioIds
          };
        }
      });
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
    console.log('Template dropdown change detected:', e.target.value);
    
    if (templateId === 0 || templateId === null) {
      // No template selected
      return;
    }
    
    // Find the selected template
    const selectedTemplate = templates.find(t => t.id === templateId);
    if (!selectedTemplate) return;
    
    console.log('Selected template:', selectedTemplate);
    
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
      
      // If the template has studio_ids property, use it (database field is snake_case)
      if ('studio_ids' in selectedTemplate && Array.isArray(selectedTemplate.studio_ids)) {
        console.log('Template has studio_ids:', selectedTemplate.studio_ids);
        updatedFormData.studioIds = [...selectedTemplate.studio_ids];
        // Also set the primary studioId to the first studio for form validation
        if (selectedTemplate.studio_ids.length > 0) {
          updatedFormData.studioId = selectedTemplate.studio_ids[0];
          console.log('Set primary studioId from template:', selectedTemplate.studio_ids[0]);
        }
      }
      // Also check for camelCase version for backwards compatibility
      else if ('studioIds' in selectedTemplate && Array.isArray(selectedTemplate.studioIds)) {
        console.log('Template has studioIds (camelCase):', selectedTemplate.studioIds);
        updatedFormData.studioIds = [...selectedTemplate.studioIds];
        if (selectedTemplate.studioIds.length > 0) {
          updatedFormData.studioId = selectedTemplate.studioIds[0];
          console.log('Set primary studioId from template:', selectedTemplate.studioIds[0]);
        }
      }
      
      // If the template has status, use it
      if (selectedTemplate.status && typeof selectedTemplate.status === 'string') {
        updatedFormData.status = selectedTemplate.status;
      }
      
      // Handle PCR room assignment from template
      if (selectedTemplate.pcrRoomId !== undefined && selectedTemplate.pcrRoomId !== null) {
        updatedFormData.pcrRoomId = selectedTemplate.pcrRoomId;
      }
      
      if ('color' in selectedTemplate && selectedTemplate.color) {
        updatedFormData.color = selectedTemplate.color;
      }
      
      if ('notifyList' in selectedTemplate && Array.isArray(selectedTemplate.notifyList)) {
        updatedFormData.notifyList = [...selectedTemplate.notifyList];
      }
      
      console.log('Updated form data with template:', updatedFormData);
      return updatedFormData;
    });
  };
  
  // Handle studio selection/deselection
  const handleStudioSelect = (studioId: number) => {
    console.log('[HANDLE STUDIO SELECT] Function called with studioId:', studioId);
    console.log('[HANDLE STUDIO SELECT] Current formData.studioIds:', formData.studioIds);
    
    setFormData(prev => {
      const currentStudioIds = prev.studioIds || [];
      console.log('[HANDLE STUDIO SELECT] Current studioIds from prev:', currentStudioIds);
      
      let updatedStudioIds;
      const index = currentStudioIds.indexOf(studioId);
      
      if (index !== -1) {
        // Remove studio
        updatedStudioIds = currentStudioIds.filter(id => id !== studioId);
        console.log('[HANDLE STUDIO SELECT] REMOVING studio:', studioId);
      } else {
        // Add studio
        updatedStudioIds = [...currentStudioIds, studioId];
        console.log('[HANDLE STUDIO SELECT] ADDING studio:', studioId);
      }
      
      // Set the first studio as the studioId for backwards compatibility
      const primaryStudioId = updatedStudioIds.length > 0 ? updatedStudioIds[0] : null;
      
      console.log('[HANDLE STUDIO SELECT] Final updatedStudioIds:', updatedStudioIds);
      console.log('[HANDLE STUDIO SELECT] Final primaryStudioId:', primaryStudioId);
      
      const newFormData = { 
        ...prev, 
        studioIds: updatedStudioIds,
        studioId: primaryStudioId
      };
      
      console.log('[HANDLE STUDIO SELECT] Complete new form data:', newFormData);
      return newFormData;
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
    
    console.log('=== MOBILE FORM SUBMISSION STARTED ===');
    console.log('[SUBMIT] Current formData state:', JSON.stringify(formData, null, 2));
    console.log('[SUBMIT] Current studioIds:', formData.studioIds);
    console.log('[SUBMIT] Current studioId:', formData.studioId);
    console.log('[SUBMIT] StudioIds type:', typeof formData.studioIds);
    console.log('[SUBMIT] StudioIds length:', formData.studioIds?.length);
    console.log('[SUBMIT] StudioIds isArray:', Array.isArray(formData.studioIds));
    
    // Validate that at least one studio is selected (check both legacy studioId and new studioIds array)
    const hasStudioSelected = (formData.studioIds && formData.studioIds.length > 0) || 
                              (formData.studioId && formData.studioId !== null && formData.studioId !== 0);
    
    console.log('[SUBMIT] ===== VALIDATION PASSED - PROCEEDING =====');
    console.log('[SUBMIT] Validation result:', hasStudioSelected);
    console.log('[SUBMIT] studioIds:', formData.studioIds);
    console.log('[SUBMIT] studioId:', formData.studioId);
    
    // IMMEDIATE TEST: Log validation details before the check
    console.log('[VALIDATION TEST] Before validation check:');
    console.log('[VALIDATION TEST] formData.studioIds:', formData.studioIds);
    console.log('[VALIDATION TEST] formData.studioIds.length:', formData.studioIds?.length);
    console.log('[VALIDATION TEST] formData.studioId:', formData.studioId);
    console.log('[VALIDATION TEST] hasStudioSelected result:', hasStudioSelected);
    
    console.log('[SUBMIT] Studio validation:', {
      hasStudioSelected,
      studioIdsLength: formData.studioIds?.length,
      studioId: formData.studioId
    });
    
    if (!hasStudioSelected) {
      console.log('[SUBMIT] VALIDATION FAILED: No studios selected');
      console.log('[SUBMIT] VALIDATION DEBUG:', {
        formDataStudioIds: formData.studioIds,
        formDataStudioId: formData.studioId,
        hasStudioSelected: hasStudioSelected
      });
      alert('Please select at least one studio before creating the booking');
      return;
    }
    
    console.log('[SUBMIT] ===== VALIDATION PASSED - PROCEEDING =====');
    
    // CRITICAL: Debug formData before processing
    console.log('[CRITICAL] Form data before processing:', JSON.stringify(formData));
    console.log('[CRITICAL] Form data studioIds before processing:', formData.studioIds);
    console.log('[CRITICAL] studioIds type:', typeof formData.studioIds);
    console.log('[CRITICAL] studioIds isArray:', Array.isArray(formData.studioIds));
    console.log('[CRITICAL] studioIds length:', formData.studioIds?.length);
    console.log('[CRITICAL] studioIds content:', formData.studioIds);
    
    // CRITICAL FIX: Use formData.studioIds which is properly maintained by the checkbox handlers
    console.log('[CRITICAL FIX] Using formData.studioIds:', formData.studioIds);
    
    // Convert string-based time values to Date objects (same as desktop BookingModal)
    const startDate = timeToDate(formData.date, formData.startTime);
    const endDate = timeToDate(formData.date, formData.endTime);
    
    // Prepare submission data with proper multi-studio support
    const submissionData = {
      id: formData.id || 0,
      title: formData.title,
      description: formData.description,
      type: formData.type,
      status: formData.status,
      severity: formData.severity,
      color: formData.color,
      templateId: formData.templateId,
      pcrRoomId: formData.pcrRoomId,
      notifyList: formData.notifyList || [],
      // Convert to Date objects for API
      start: startDate,
      end: endDate,
      // Multi-studio support
      studioIds: formData.studioIds || [],
      studioId: formData.studioIds && formData.studioIds.length > 0 
        ? formData.studioIds[0] 
        : null
    };
    
    console.log('[CRITICAL] Form data after processing:', JSON.stringify(submissionData));
    console.log('[CRITICAL] Final studioIds array:', submissionData.studioIds);
    console.log('[CRITICAL] Final studioIds type:', typeof submissionData.studioIds);
    console.log('[CRITICAL] Final studioIds isArray:', Array.isArray(submissionData.studioIds));
    console.log('[CRITICAL] Final studioIds length:', submissionData.studioIds?.length);
    
    // ULTRA CRITICAL: Test JSON.stringify on just the studioIds
    console.log('[ULTRA CRITICAL] JSON.stringify(submissionData.studioIds):', JSON.stringify(submissionData.studioIds));
    console.log('[ULTRA CRITICAL] JSON.stringify(submissionData):', JSON.stringify(submissionData));
    console.log('[CRITICAL] VERIFICATION: studioIds length before submission:', submissionData.studioIds?.length);
    console.log('[CRITICAL] VERIFICATION: studioIds content before submission:', submissionData.studioIds);
    
    // FINAL VERIFICATION: Ensure we're not losing data
    if (!submissionData.studioIds || submissionData.studioIds.length === 0) {
      console.error('[CRITICAL ERROR] studioIds is empty or null before submission!');
      console.error('[CRITICAL ERROR] formData.studioIds:', formData.studioIds);
      // Use formData.studioIds as fallback
      submissionData.studioIds = formData.studioIds || [];
      console.log('[CRITICAL FIX] Applied fallback studioIds:', submissionData.studioIds);
    }
    
    console.log('[SUBMIT] SimpleMobileForm - Final form data with multi-studio support:', submissionData);
    console.log('[SUBMIT] SimpleMobileForm - Studios selected:', submissionData.studioIds);
    console.log('[SUBMIT] Studio data validation:', {
      studioId: submissionData.studioId,
      studioIds: submissionData.studioIds,
      studioIdsLength: submissionData.studioIds?.length,
      studioIdsType: typeof submissionData.studioIds,
      isArray: Array.isArray(submissionData.studioIds)
    });
    
    // CRITICAL: Ensure studioIds is always included in submission
    console.log('[CRITICAL] About to call onSubmit with studioIds:', submissionData.studioIds);
    console.log('[CRITICAL] Calling onSubmit with data:', JSON.stringify(submissionData));
    console.log('=== CALLING onSubmit FUNCTION ===');
    
    // DEBUGGING: Log the exact onSubmit function being called
    console.log('[CRITICAL] onSubmit function type:', typeof onSubmit);
    console.log('[CRITICAL] FINAL submissionData being sent:', JSON.stringify(submissionData));
    console.log('[CRITICAL] FINAL submissionData.studioIds:', submissionData.studioIds);
    
    // EMERGENCY DEBUG: Log the exact function being called
    console.log('[EMERGENCY] onSubmit function source code preview:', onSubmit.toString().substring(0, 500));
    
    // CRITICAL DEBUG: Test if the issue is with the onSubmit function
    console.log('[EMERGENCY] About to call onSubmit with submissionData containing studioIds:', submissionData.studioIds);
    console.log('[EMERGENCY] submissionData object keys:', Object.keys(submissionData));
    console.log('[EMERGENCY] submissionData.studioIds exists?', 'studioIds' in submissionData);
    console.log('[EMERGENCY] submissionData.studioIds value before call:', JSON.stringify(submissionData.studioIds));
    
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
            <label>Studios* (Selected: {(formData.studioIds || []).length})</label>
            <div className="studio-multi-select">
              {studios.map(studio => (
                <div key={studio.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    id={`studio-${studio.id}`}
                    checked={(formData.studioIds || []).includes(studio.id)}
                    onChange={() => {
                      console.log('[STUDIO CHECKBOX] Studio checkbox clicked:', studio.id);
                      console.log('[STUDIO CHECKBOX] Current studioIds before click:', formData.studioIds);
                      handleStudioSelect(studio.id);
                    }}
                  />
                  <label htmlFor={`studio-${studio.id}`}>
                    {studio.name} 
                    {(formData.studioIds || []).includes(studio.id) ? ' ✓' : ''}
                  </label>
                </div>
              ))}
            </div>
            {(formData.studioIds || []).length === 0 && (
              <div className="error-hint">Please select at least one studio</div>
            )}
            
            {/* Debug information */}
            <div style={{ fontSize: '10px', color: '#666', marginTop: '8px' }}>
              Debug: studioIds = [{(formData.studioIds || []).join(', ')}]
            </div>
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
              <Select 
                value={formData.startTime} 
                onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, startTime: value }));
                }}
              >
                <SelectTrigger id="sm-start-time" className="form-input">
                  <SelectValue placeholder="Select start time" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {generateTimeOptions().map((time: string) => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="sm-end-time">End Time*</label>
            <Select 
              value={formData.endTime} 
              onValueChange={(value) => {
                setFormData(prev => ({ ...prev, endTime: value }));
              }}
            >
              <SelectTrigger id="sm-end-time" className="form-input">
                <SelectValue placeholder="Select end time" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {generateTimeOptions().map((time: string) => (
                  <SelectItem key={time} value={time}>{time}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                <option value="maintenance">Maintenance</option>
                <option value="alert">Alert</option>
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
            <div className="form-actions-left">
              {booking && (
                <button 
                  type="button" 
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this booking? This action cannot be undone.')) {
                      deleteBooking.mutate(booking.id, {
                        onSuccess: () => {
                          // Comprehensive cache invalidation to refresh ALL mobile views
                          // Invalidate all booking-related queries with pattern matching
                          queryClient.invalidateQueries({ 
                            predicate: (query) => {
                              const key = query.queryKey[0];
                              return typeof key === 'string' && (
                                key.includes('/api/bookings') || 
                                key.includes('/api/booking-studios') ||
                                key.includes('/api/public/booking-studios')
                              );
                            }
                          });
                          
                          // Also invalidate the specific patterns used by mobile calendar
                          queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/bookings/user'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/booking-studios'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/public/booking-studios'] });
                          
                          // Force refetch of all data to ensure mobile view updates
                          queryClient.refetchQueries({ 
                            predicate: (query) => {
                              const key = query.queryKey[0];
                              return typeof key === 'string' && key.includes('/api/bookings');
                            }
                          });
                          
                          toast({
                            title: "Success",
                            description: "Booking deleted successfully",
                            variant: "default"
                          });
                          onClose();
                        },
                        onError: (error: any) => {
                          toast({
                            title: "Error",
                            description: error.message || "Failed to delete booking",
                            variant: "destructive"
                          });
                        }
                      });
                    }
                  }}
                  className="delete-button"
                  disabled={deleteBooking.isPending}
                >
                  {deleteBooking.isPending ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </div>
            <div className="form-actions-right">
              <button type="button" className="cancel-button" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="submit-button">
                {booking ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}