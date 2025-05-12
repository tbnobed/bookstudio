import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BookingType, FormBookingData, ApiBooking } from '../../types/bookings';
import { formatDateForForm, formatTimeForForm } from '../../utils/dateUtils';
import { X, CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePcrRooms } from '../../hooks/usePcrRooms';
import { useTemplates } from '../../hooks/useTemplates';
import { useNotificationGroups } from '../../hooks/useNotificationGroups';
import { useStudios } from '../../hooks/useStudios';
import './simple-mobile.css';

type SimpleMobileFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FormBookingData) => void;
  booking?: ApiBooking | null;
  selectedStudio?: number | null;
  defaultStudioId?: number;
};

export function SimpleMobileForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  booking,
  selectedStudio,
  defaultStudioId = 1
}: SimpleMobileFormProps) {
  const [formData, setFormData] = useState<FormBookingData>({
    id: 0,
    title: '',
    description: '',
    studioId: defaultStudioId,
    pcrRoomId: 0,
    type: 'production' as BookingType,
    start: new Date().toISOString(),
    end: new Date().toISOString(),
    templateId: 0,
    notifyList: [],
    severity: 'medium',
    status: 'confirmed',
    color: '#4B83E2',
  });

  // Initialize with booking data if provided
  useEffect(() => {
    if (booking) {
      setFormData({
        id: booking.id || 0,
        title: booking.title || '',
        description: booking.description || '',
        studioId: selectedStudio || booking.studioId || defaultStudioId,
        pcrRoomId: booking.pcrRoomId || 0,
        type: booking.type as BookingType || 'production',
        start: booking.start || new Date().toISOString(),
        end: booking.end || new Date().toISOString(),
        templateId: booking.templateId || 0,
        notifyList: booking.notifyList || [],
        severity: booking.severity || 'medium',
        status: booking.status || 'confirmed',
        color: booking.color || '#4B83E2',
      });
    } else {
      // Default start/end time to current hour + 1 hour
      const now = new Date();
      now.setMinutes(0, 0, 0); // Reset to the start of the hour
      
      const oneHourLater = new Date(now);
      oneHourLater.setHours(now.getHours() + 1);
      
      setFormData(prev => ({
        ...prev,
        studioId: selectedStudio || defaultStudioId,
        start: now.toISOString(),
        end: oneHourLater.toISOString(),
      }));
    }
  }, [booking, selectedStudio, defaultStudioId]);

  // Update form field
  const updateFormField = (field: keyof FormBookingData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!isOpen) return null;

  // Format dates for display
  const startDate = formatDateForForm(formData.start);
  const startTime = formatTimeForForm(formData.start);
  const endDate = formatDateForForm(formData.end);
  const endTime = formatTimeForForm(formData.end);

  return (
    <div className="simple-mobile-overlay">
      <div className="simple-mobile-container">
        <div className="simple-mobile-header">
          <h2>{booking ? 'Edit Booking' : 'New Booking'}</h2>
          <button className="simple-mobile-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="simple-mobile-form">
          <div className="form-group">
            <Label htmlFor="mobile-title">Title</Label>
            <Input
              id="mobile-title"
              value={formData.title}
              onChange={(e) => updateFormField('title', e.target.value)}
              placeholder="Booking title"
              required
            />
          </div>
          
          <div className="form-group">
            <Label htmlFor="mobile-description">Description</Label>
            <Textarea
              id="mobile-description"
              value={formData.description}
              onChange={(e) => updateFormField('description', e.target.value)}
              placeholder="Booking description"
              className="h-20"
            />
          </div>
          
          <div className="date-time-group">
            <div className="form-group">
              <Label htmlFor="mobile-start-date">Start Date</Label>
              <Input
                id="mobile-start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  // Handle date change logic
                }}
              />
            </div>
            
            <div className="form-group">
              <Label htmlFor="mobile-start-time">Start Time</Label>
              <Input
                id="mobile-start-time"
                type="time"
                value={startTime}
                onChange={(e) => {
                  // Handle time change logic
                }}
              />
            </div>
          </div>
          
          <div className="date-time-group">
            <div className="form-group">
              <Label htmlFor="mobile-end-date">End Date</Label>
              <Input
                id="mobile-end-date"
                type="date"
                value={endDate}
                onChange={(e) => {
                  // Handle date change logic
                }}
              />
            </div>
            
            <div className="form-group">
              <Label htmlFor="mobile-end-time">End Time</Label>
              <Input
                id="mobile-end-time"
                type="time"
                value={endTime}
                onChange={(e) => {
                  // Handle time change logic
                }}
              />
            </div>
          </div>
          
          <div className="form-buttons">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {booking ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}