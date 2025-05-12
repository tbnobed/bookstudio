import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BookingType, FormBookingData, ApiBooking } from '../../types/bookings';
import { formatDateForForm, formatTimeForForm, createDateFromInputs } from '../../utils/dateUtils';
import { X } from 'lucide-react';
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
  defaultStudioId 
}: SimpleMobileFormProps) {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(formatDateForForm(new Date().toISOString()));
  const [startTime, setStartTime] = useState(formatTimeForForm(new Date().toISOString()));
  const [endTime, setEndTime] = useState(formatTimeForForm(new Date(new Date().getTime() + 60 * 60 * 1000).toISOString()));
  
  // Initialize form when a booking is provided (for editing)
  useEffect(() => {
    if (booking) {
      setTitle(booking.title || '');
      setDescription(booking.description || '');
      setDate(formatDateForForm(booking.start));
      setStartTime(formatTimeForForm(booking.start));
      setEndTime(formatTimeForForm(booking.end));
    } else {
      // Reset form for new bookings
      setTitle('');
      setDescription('');
      setDate(formatDateForForm(new Date().toISOString()));
      setStartTime(formatTimeForForm(new Date().toISOString()));
      setEndTime(formatTimeForForm(new Date(new Date().getTime() + 60 * 60 * 1000).toISOString()));
    }
  }, [booking, isOpen]);
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create ISO date strings from form inputs
    const startDate = createDateFromInputs(date, startTime);
    const endDate = createDateFromInputs(date, endTime);
    
    // Prepare form data
    const formData: FormBookingData = {
      id: booking?.id || 0,
      title,
      description,
      studioId: selectedStudio || defaultStudioId || booking?.studioId || booking?.studio_id || 1,
      pcrRoomId: booking?.pcrRoomId || booking?.pcr_room_id || 0,
      type: (booking?.type || 'production') as BookingType,
      start: startDate,
      end: endDate,
      templateId: booking?.templateId || booking?.template_id || 0,
      notifyList: booking?.notifyList || booking?.notify_list || [],
      severity: booking?.severity || 'medium',
      status: booking?.status || 'confirmed',
      color: booking?.color || '#4B83E2'
    };
    
    onSubmit(formData);
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="simple-mobile-overlay">
      <div className="simple-mobile-container">
        <div className="simple-mobile-header">
          <h2>{booking ? 'Edit Booking' : 'New Booking'}</h2>
          <button 
            className="simple-mobile-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="simple-mobile-form">
          <div className="form-group">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Booking title"
              required
            />
          </div>
          
          <div className="form-group">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Booking description"
              rows={3}
            />
          </div>
          
          <div className="form-group">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="form-actions">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="cancel-button"
            >
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