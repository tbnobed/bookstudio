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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{booking ? 'Edit Booking' : 'New Booking'}</DialogTitle>
        </DialogHeader>
        <form id="booking-form" onSubmit={handleSubmit} className="space-y-4">

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title*</Label>
            <Input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => updateFormField('title', e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateFormField('description', e.target.value)}
              rows={3}
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Date*</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => updateFormField('date', e.target.value)}
              required
            />
          </div>

          {/* Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-time">Start Time*</Label>
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

            <div className="space-y-2">
              <Label htmlFor="end-time">End Time*</Label>
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
          <div className="space-y-2">
            <Label>Studios*</Label>
            <div className="grid grid-cols-2 gap-2">
              {studiosData.map((studio) => (
                <div 
                  key={studio.id} 
                  className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50"
                  onClick={() => handleStudioSelect(studio.id)}
                >
                  <Checkbox 
                    checked={formData.studioIds.includes(studio.id.toString())}
                    onChange={() => {}} // Handled by parent onClick
                  />
                  <Camera className="h-4 w-4" />
                  <span className="text-sm">{studio.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* PCR Room */}
          <div className="space-y-2">
            <Label htmlFor="pcr-room">PCR Room</Label>
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
          <div className="space-y-2">
            <Label htmlFor="template">Template</Label>
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

        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="booking-form">
            {booking ? 'Update' : 'Create'} Booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}