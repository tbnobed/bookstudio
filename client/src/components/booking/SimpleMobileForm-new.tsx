import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import { Studio, Template, PcrRoom, InsertBooking, NotificationGroup, Booking } from "@shared/schema";
import { useStudioBookings } from "@/hooks/useStudioBookings";
import { formatTime, generateTimeOptions, timeToDate, formatDateForForm } from "@/lib/dateUtils";
import { Camera, Monitor, Trash2 } from "lucide-react";
import { useNotification } from "@/hooks/use-notification";

interface SimpleMobileFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
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
  const { showNotification } = useNotification();
  const { createBooking, updateBooking, deleteBooking } = useStudioBookings();

  // Get data - exactly like desktop BookingModal
  const { data: studiosData = [] } = useQuery<Studio[]>({ queryKey: ["/api/studios"] });
  const { data: templatesData = [] } = useQuery<Template[]>({ queryKey: ["/api/templates"] });
  const { data: pcrRoomsData = [] } = useQuery<PcrRoom[]>({ queryKey: ["/api/pcr-rooms"] });
  const { data: notificationGroupsData = [] } = useQuery<NotificationGroup[]>({ queryKey: ["/api/notification-groups"] });

  // Form state - exactly like desktop BookingModal
  const [formData, setFormData] = useState({
    id: booking?.id || 0,
    title: booking?.title || '',
    description: booking?.description || '',
    studioIds: [] as string[], // Array for multiple studios
    pcrRoomId: "none",
    bookingType: alertMode ? "maintenance" : "production",
    status: "confirmed",
    date: formatDateForForm(selectedDate),
    startTime: "9:00am",
    endTime: "10:00am",
    templateId: "none",
    notifyList: [] as string[],
    saveAsTemplate: false,
    templateName: "",
    severity: "medium",
    color: booking ? booking.color : "#4B83E2"
  });

  // Update form field function - exactly like desktop
  const updateFormField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle submission - convert to API format like desktop
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      showNotification({
        type: "error",
        title: "Validation Error",
        message: "Title is required"
      });
      return;
    }

    if (formData.studioIds.length === 0) {
      showNotification({
        type: "error", 
        title: "Validation Error",
        message: "Please select at least one studio"
      });
      return;
    }

    // Convert form data to API format - exactly like desktop
    const startDate = timeToDate(formData.date, formData.startTime);
    const endDate = timeToDate(formData.date, formData.endTime);

    const bookingData = {
      title: formData.title,
      description: formData.description,
      type: formData.bookingType,
      status: formData.status,
      severity: formData.severity,
      color: formData.color,
      start: startDate,
      end: endDate,
      notifyList: formData.notifyList,
    };

    // Add template ID if selected
    if (formData.templateId && formData.templateId !== "" && formData.templateId !== "0" && formData.templateId !== "none") {
      (bookingData as any).templateId = parseInt(formData.templateId);
    } else {
      (bookingData as any).templateId = null;
    }
    
    // Add PCR room ID if selected
    if (formData.pcrRoomId && formData.pcrRoomId !== "" && formData.pcrRoomId !== "none") {
      (bookingData as any).pcrRoomId = parseInt(formData.pcrRoomId);
    } else {
      (bookingData as any).pcrRoomId = null;
    }
    
    // Convert studioIds from strings to numbers
    const studioIds = formData.studioIds.map(id => parseInt(id));
    
    try {
      if (booking && booking.id && booking.id !== 0) {
        // Update existing booking
        await updateBooking.mutateAsync({ 
          id: booking.id, 
          data: bookingData,
          studioIds: studioIds
        });
        
        showNotification({
          type: "success",
          title: "Success",
          message: "Booking updated successfully"
        });
      } else {
        // Create new booking
        await createBooking.mutateAsync({
          ...bookingData as InsertBooking,
          studioIds: studioIds
        });
        
        showNotification({
          type: "success",
          title: "Success", 
          message: "Booking created successfully"
        });
      }
      
      onClose();
    } catch (error) {
      showNotification({
        type: "error",
        title: "Error",
        message: error instanceof Error ? error.message : "An error occurred"
      });
    }
  };

  // Handle studio selection
  const handleStudioSelect = (studioId: number) => {
    const studioIdStr = studioId.toString();
    const currentStudioIds = formData.studioIds || [];
    
    if (currentStudioIds.includes(studioIdStr)) {
      // Remove studio
      const updatedStudioIds = currentStudioIds.filter(id => id !== studioIdStr);
      setFormData(prev => ({ ...prev, studioIds: updatedStudioIds }));
    } else {
      // Add studio
      const updatedStudioIds = [...currentStudioIds, studioIdStr];
      setFormData(prev => ({ ...prev, studioIds: updatedStudioIds }));
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="simple-mobile-form open"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div 
        className="simple-mobile-overlay" 
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)'
        }}
      ></div>
      <div 
        className="simple-mobile-content"
        style={{
          position: 'relative',
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '20px',
          maxWidth: '400px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
      >
        <form onSubmit={handleSubmit}>
          <div 
            className="form-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '1px solid #e0e0e0',
              paddingBottom: '10px'
            }}
          >
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
              {booking ? 'Edit Booking' : 'New Booking'}
            </h2>
            <button 
              type="button" 
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '0',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >×</button>
          </div>

          {/* Title */}
          <div 
            className="form-group"
            style={{ marginBottom: '15px' }}
          >
            <label 
              htmlFor="title"
              style={{ 
                display: 'block', 
                marginBottom: '5px', 
                fontWeight: '500',
                fontSize: '14px'
              }}
            >
              Title*
            </label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => updateFormField('title', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
              required
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateFormField('description', e.target.value)}
              className="form-input"
              rows={3}
            />
          </div>

          {/* Date */}
          <div className="form-group">
            <label htmlFor="date">Date*</label>
            <input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => updateFormField('date', e.target.value)}
              className="form-input"
              required
            />
          </div>

          {/* Time Selection */}
          <div className="time-row">
            <div className="form-group">
              <label htmlFor="start-time">Start Time*</label>
              <Select 
                value={formData.startTime} 
                onValueChange={(value) => updateFormField('startTime', value)}
              >
                <SelectTrigger className="form-select">
                  <SelectValue placeholder="Select start time" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {generateTimeOptions().map((time) => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="form-group">
              <label htmlFor="end-time">End Time*</label>
              <Select 
                value={formData.endTime} 
                onValueChange={(value) => updateFormField('endTime', value)}
              >
                <SelectTrigger className="form-select">
                  <SelectValue placeholder="Select end time" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {generateTimeOptions().map((time) => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Studios */}
          <div className="form-group">
            <label>Studios*</label>
            <div className="studios-grid">
              {studiosData.map((studio) => (
                <div 
                  key={studio.id} 
                  className="studio-checkbox"
                  onClick={() => handleStudioSelect(studio.id)}
                >
                  <Checkbox 
                    checked={formData.studioIds.includes(studio.id.toString())}
                    onChange={() => {}} // Handled by parent onClick
                  />
                  <Camera className="h-4 w-4" />
                  <span>{studio.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* PCR Room */}
          <div className="form-group">
            <label htmlFor="pcr-room">PCR Room</label>
            <Select 
              value={formData.pcrRoomId} 
              onValueChange={(value) => updateFormField('pcrRoomId', value)}
            >
              <SelectTrigger className="form-select">
                <SelectValue placeholder="Select PCR room" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {pcrRoomsData.map((room) => (
                  <SelectItem key={room.id} value={room.id.toString()}>
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      {room.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Templates */}
          <div className="form-group">
            <label htmlFor="template">Template</label>
            <Select 
              value={formData.templateId} 
              onValueChange={(value) => updateFormField('templateId', value)}
            >
              <SelectTrigger className="form-select">
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {templatesData.map((template) => (
                  <SelectItem key={template.id} value={template.id.toString()}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div 
            className="form-actions"
            style={{
              display: 'flex',
              gap: '10px',
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '1px solid #e0e0e0'
            }}
          >
            <button 
              type="button" 
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px 15px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'white',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button 
              type="submit"
              style={{
                flex: 1,
                padding: '10px 15px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: '#3b82f6',
                color: 'white',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {booking ? 'Update' : 'Create'} Booking
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}