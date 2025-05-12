import React, { useState, useEffect } from 'react';
import './direct-mobile.css';
import { X } from 'lucide-react';
import { formatDateForForm, formatTimeForForm, createDateFromInputs } from '../../utils/dateUtils';

// Simple form types
interface FormData {
  id: number;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  pcrRoom: string;
  template: string;
  bookingType: string;
  bookingStatus: string;
  notifyGroups: string[];
  color: string;
  studioIds: number[];
}

interface DirectMobileFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  studios: { id: number; name: string }[];
  pcrRooms: { id: number; name: string }[];
  templates: { id: number; name: string }[];
  notificationGroups: { id: number; name: string }[];
  initialData?: any;
}

export function DirectMobileForm({
  isOpen,
  onClose,
  onSubmit,
  studios,
  pcrRooms,
  templates,
  notificationGroups,
  initialData
}: DirectMobileFormProps) {
  // Default form data
  const defaultFormData: FormData = {
    id: 0,
    title: '',
    description: '',
    date: formatDateForForm(new Date().toISOString()),
    startTime: formatTimeForForm(new Date().toISOString()),
    endTime: formatTimeForForm(new Date(new Date().getTime() + 60 * 60 * 1000).toISOString()),
    pcrRoom: 'None',
    template: 'None',
    bookingType: 'Production',
    bookingStatus: 'Confirmed',
    notifyGroups: [],
    color: '#4B83E2',
    studioIds: [studios[0]?.id || 1],
  };

  // Form state
  const [formData, setFormData] = useState<FormData>(defaultFormData);

  // Initialize with provided data if available
  useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id || 0,
        title: initialData.title || '',
        description: initialData.description || '',
        date: formatDateForForm(initialData.start || new Date().toISOString()),
        startTime: formatTimeForForm(initialData.start || new Date().toISOString()),
        endTime: formatTimeForForm(initialData.end || new Date(new Date().getTime() + 60 * 60 * 1000).toISOString()),
        pcrRoom: initialData.pcrRoomId ? initialData.pcrRoomId.toString() : 'None',
        template: initialData.templateId ? initialData.templateId.toString() : 'None',
        bookingType: initialData.type || 'Production',
        bookingStatus: initialData.status || 'Confirmed',
        notifyGroups: initialData.notifyList || [],
        color: initialData.color || '#4B83E2',
        studioIds: initialData.studioId ? [initialData.studioId] : [studios[0]?.id || 1],
      });
    } else {
      setFormData(defaultFormData);
    }
  }, [initialData, studios]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create ISO date strings from form inputs
    const startDate = createDateFromInputs(formData.date, formData.startTime);
    const endDate = createDateFromInputs(formData.date, formData.endTime);

    // Format data for API
    const submitData = {
      id: formData.id,
      title: formData.title,
      description: formData.description,
      studioId: formData.studioIds[0], // Use first studio ID
      pcrRoomId: formData.pcrRoom !== 'None' ? parseInt(formData.pcrRoom) : 0,
      type: formData.bookingType.toLowerCase(),
      start: startDate,
      end: endDate,
      templateId: formData.template !== 'None' ? parseInt(formData.template) : 0,
      notifyList: formData.notifyGroups.map(g => parseInt(g)),
      severity: 'medium',
      status: formData.bookingStatus.toLowerCase(),
      color: formData.color,
    };

    onSubmit(submitData);
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // Handle checkbox changes
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked, value } = e.target;
    
    if (name === 'notifyGroups') {
      const updatedGroups = [...formData.notifyGroups];
      if (checked) {
        updatedGroups.push(value);
      } else {
        const index = updatedGroups.indexOf(value);
        if (index > -1) {
          updatedGroups.splice(index, 1);
        }
      }
      setFormData({
        ...formData,
        notifyGroups: updatedGroups,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="direct-mobile-overlay">
      <div className="direct-mobile-container">
        <div className="direct-mobile-header">
          <h2>{initialData ? 'Edit Booking' : 'New Booking'}</h2>
          <button className="direct-mobile-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="direct-mobile-form">
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Booking title"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Booking description"
              rows={3}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="date">Date</label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="startTime">Start Time</label>
            <input
              type="time"
              id="startTime"
              name="startTime"
              value={formData.startTime}
              onChange={handleInputChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="endTime">End Time</label>
            <input
              type="time"
              id="endTime"
              name="endTime"
              value={formData.endTime}
              onChange={handleInputChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="pcrRoom">PCR Room (Optional)</label>
            <select
              id="pcrRoom"
              name="pcrRoom"
              value={formData.pcrRoom}
              onChange={handleInputChange}
            >
              <option value="None">None</option>
              {pcrRooms.map(room => (
                <option key={room.id} value={room.id.toString()}>{room.name}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="template">Template (Optional)</label>
            <select
              id="template"
              name="template"
              value={formData.template}
              onChange={handleInputChange}
            >
              <option value="None">None</option>
              {templates.map(template => (
                <option key={template.id} value={template.id.toString()}>{template.name}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="bookingType">Booking Type</label>
            <select
              id="bookingType"
              name="bookingType"
              value={formData.bookingType}
              onChange={handleInputChange}
            >
              <option value="Production">Production</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Other">Other</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="bookingStatus">Booking Status</label>
            <select
              id="bookingStatus"
              name="bookingStatus"
              value={formData.bookingStatus}
              onChange={handleInputChange}
            >
              <option value="Confirmed">Confirmed</option>
              <option value="Pending">Pending</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          
          <div className="form-group notification-group">
            <label>Notify</label>
            <div className="notify-checkboxes">
              {notificationGroups.map(group => (
                <div key={group.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    id={`notify-${group.id}`}
                    name="notifyGroups"
                    value={group.id.toString()}
                    checked={formData.notifyGroups.includes(group.id.toString())}
                    onChange={handleCheckboxChange}
                  />
                  <label htmlFor={`notify-${group.id}`}>{group.name}</label>
                </div>
              ))}
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="color">Booking Color</label>
            <div className="color-picker">
              <input
                type="color"
                id="color"
                name="color"
                value={formData.color}
                onChange={handleInputChange}
              />
              <span>Custom color for calendar display</span>
            </div>
          </div>
          
          <div className="form-buttons">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-submit">
              {initialData ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}