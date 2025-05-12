import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateForForm, formatTimeForForm } from '../../utils/dateUtils';
import { FormBookingData, ApiBooking, BookingType, BookingStatus, BookingSeverity } from '../../types/bookings';
import { Studio } from '../../types/studios';
import { PcrRoom } from '../../types/pcr-rooms';
import { useStudios } from '../../hooks/useStudios';
import { usePcrRooms } from '../../hooks/usePcrRooms';
import './simple-mobile.css';

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
  
  // Initialize form data with default values or existing booking data
  const [formData, setFormData] = useState<FormBookingData>({
    id: booking?.id || 0,
    title: booking?.title || '',
    description: booking?.description || '',
    studioId: selectedStudio || booking?.studioId || (studios[0]?.id || 0),
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
  const handleChange = (field: string, value: any) => {
    setFormData(prev => {
      // Special case for notifyList which needs to be an array
      if (field === 'notifyList') {
        if (typeof value === 'string') {
          return {
            ...prev,
            notifyList: value.split(',').map(email => email.trim())
          };
        }
      }
      
      // Handle empty studioId as number
      if (field === 'studioId' && value === '') {
        return {
          ...prev,
          studioId: 0
        };
      }
      
      return {
        ...prev,
        [field]: value
      };
    });
  };
  
  // Handle date and time changes
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'startDate') {
      const [currentDate, currentTime] = formData.start.toISOString().split('T');
      const newDateTimeStr = `${value}T${currentTime}`;
      const newDate = new Date(newDateTimeStr);
      setFormData(prev => ({ ...prev, start: newDate }));
    } else if (name === 'endDate') {
      const [currentDate, currentTime] = formData.end.toISOString().split('T');
      const newDateTimeStr = `${value}T${currentTime}`;
      const newDate = new Date(newDateTimeStr);
      setFormData(prev => ({ ...prev, end: newDate }));
    } else if (name === 'startTime') {
      const currentDate = formData.start.toISOString().split('T')[0];
      const newDateTimeStr = `${currentDate}T${value}:00`;
      const newDate = new Date(newDateTimeStr);
      setFormData(prev => ({ ...prev, start: newDate }));
    } else if (name === 'endTime') {
      const currentDate = formData.end.toISOString().split('T')[0];
      const newDateTimeStr = `${currentDate}T${value}:00`;
      const newDate = new Date(newDateTimeStr);
      setFormData(prev => ({ ...prev, end: newDate }));
    }
  };
  
  // Handle select changes
  const handleSelectChange = (field: string, value: string) => {
    if (field === 'studioId' || field === 'pcrRoomId' || field === 'templateId') {
      setFormData(prev => ({ ...prev, [field]: parseInt(value, 10) }));
    } else if (field === 'type' || field === 'status' || field === 'severity') {
      setFormData(prev => ({ ...prev, [field]: value }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('SimpleMobileForm - Submitting:', formData);
    onSubmit(formData);
  };
  
  // Auto focus first field on open
  useEffect(() => {
    if (isOpen) {
      const titleInput = document.getElementById('mobile-title');
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
          >
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="simple-mobile-form">
          <div className="form-group">
            <Label htmlFor="mobile-title">Title</Label>
            <Input 
              id="mobile-title"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              required 
            />
          </div>
          
          <div className="form-group">
            <Label htmlFor="mobile-description">Description</Label>
            <Textarea 
              id="mobile-description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="form-group">
            <Label htmlFor="mobile-studio">Studio</Label>
            <Select 
              value={formData.studioId.toString()}
              onValueChange={(value) => handleSelectChange('studioId', value)}
            >
              <SelectTrigger id="mobile-studio">
                <SelectValue placeholder="Select a studio" />
              </SelectTrigger>
              <SelectContent>
                {studios.map((studio) => (
                  <SelectItem key={studio.id} value={studio.id.toString()}>
                    {studio.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="form-group">
            <Label htmlFor="mobile-pcr-room">PCR Room</Label>
            <Select 
              value={formData.pcrRoomId.toString()}
              onValueChange={(value) => handleSelectChange('pcrRoomId', value)}
            >
              <SelectTrigger id="mobile-pcr-room">
                <SelectValue placeholder="Select a PCR room" />
              </SelectTrigger>
              <SelectContent>
                {pcrRooms.map((pcrRoom) => (
                  <SelectItem key={pcrRoom.id} value={pcrRoom.id.toString()}>
                    {pcrRoom.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <Label htmlFor="mobile-start-date">Start Date</Label>
              <Input 
                id="mobile-start-date"
                type="date"
                name="startDate"
                value={formatDateForForm(formData.start)}
                onChange={handleDateChange}
                required
              />
            </div>
            <div className="form-group">
              <Label htmlFor="mobile-start-time">Start Time</Label>
              <Input 
                id="mobile-start-time"
                type="time"
                name="startTime"
                value={formatTimeForForm(formData.start)}
                onChange={handleDateChange}
                required
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <Label htmlFor="mobile-end-date">End Date</Label>
              <Input 
                id="mobile-end-date"
                type="date"
                name="endDate"
                value={formatDateForForm(formData.end)}
                onChange={handleDateChange}
                required
              />
            </div>
            <div className="form-group">
              <Label htmlFor="mobile-end-time">End Time</Label>
              <Input 
                id="mobile-end-time"
                type="time"
                name="endTime"
                value={formatTimeForForm(formData.end)}
                onChange={handleDateChange}
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <Label htmlFor="mobile-type">Booking Type</Label>
            <Select 
              value={formData.type}
              onValueChange={(value) => handleSelectChange('type', value)}
            >
              <SelectTrigger id="mobile-type">
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="alert">Alert</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {(formData.type === 'production' || formData.type === 'other') && (
            <div className="form-group">
              <Label htmlFor="mobile-status">Status</Label>
              <Select 
                value={formData.status}
                onValueChange={(value) => handleSelectChange('status', value)}
              >
                <SelectTrigger id="mobile-status">
                  <SelectValue placeholder="Select a status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {(formData.type === 'maintenance' || formData.type === 'alert') && (
            <div className="form-group">
              <Label htmlFor="mobile-severity">Severity</Label>
              <Select 
                value={formData.severity}
                onValueChange={(value) => handleSelectChange('severity', value)}
              >
                <SelectTrigger id="mobile-severity">
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="form-group">
            <Label htmlFor="mobile-color">Color</Label>
            <Input 
              id="mobile-color"
              type="color"
              value={formData.color}
              onChange={(e) => handleChange('color', e.target.value)}
            />
          </div>
          
          <div className="form-actions">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {booking ? 'Update' : 'Create'} Booking
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}