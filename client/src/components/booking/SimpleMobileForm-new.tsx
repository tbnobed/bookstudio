import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  // alertMode removed - this component only handles bookings
}

interface FormData {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  bookingType: string;
  status: string;
  // severity removed - production bookings don't use severity
  color: string;
  templateId: string;
  templateName: string;
  pcrRoomId: string;
  studioIds: string[];
  notifyList: string[];
  saveAsTemplate: boolean;
}

export default function SimpleMobileForm({ 
  isOpen, 
  onClose, 
  onSubmit,
  booking,
  selectedDate = new Date(),
  selectedStudio
}: SimpleMobileFormProps) {
  const { showNotification } = useNotification();
  const { createBooking, updateBooking, deleteBooking, createTemplate } = useStudioBookings();
  
  // Fetch data using the same queries as desktop
  const { data: studios = [] } = useQuery<Studio[]>({ queryKey: ["/api/studios"] });
  const { data: templates = [] } = useQuery<Template[]>({ queryKey: ["/api/templates"] });
  const { data: pcrRooms = [] } = useQuery<PcrRoom[]>({ queryKey: ["/api/pcr-rooms"] });
  const { data: notificationGroups = [] } = useQuery<NotificationGroup[]>({ queryKey: ["/api/notification-groups"] });



  // Default form values for booking creation only
  const getDefaultFormData = (): FormData => ({
    title: "",
    description: "",
    date: formatDateForForm(selectedDate),
    startTime: "9:00am",
    endTime: "10:00am",
    bookingType: "production", // Always production since this is booking-only
    status: "confirmed",
    // severity: removed - production bookings don't use severity
    color: "#3b82f6",
    templateId: "",
    templateName: "",
    pcrRoomId: "none",
    studioIds: selectedStudio ? [selectedStudio.toString()] : [],
    notifyList: [],
    saveAsTemplate: false,
  });

  const [formData, setFormData] = useState<FormData>(getDefaultFormData());

  // Update form field helper with time validation
  const updateFormField = (field: keyof FormData, value: any) => {
    // Special handling for time fields to prevent invalid time ranges
    if (field === 'startTime') {
      // Convert current endTime for comparison
      const currentEndDate = timeToDate(formData.date, formData.endTime);
      const newStartDate = timeToDate(formData.date, value);
      
      if (newStartDate >= currentEndDate) {
        showNotification({
          type: "error",
          title: "Invalid Time",
          message: "Start time cannot be later than or equal to end time. Please select an earlier time."
        });
        return; // Don't update the form data
      }
    } else if (field === 'endTime') {
      // Convert current startTime for comparison
      const currentStartDate = timeToDate(formData.date, formData.startTime);
      const newEndDate = timeToDate(formData.date, value);
      
      if (newEndDate <= currentStartDate) {
        showNotification({
          type: "error",
          title: "Invalid Time",
          message: "End time cannot be earlier than or equal to start time. Please select a later time."
        });
        return; // Don't update the form data
      }
    }
    
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Initialize form data when booking changes (same logic as desktop)
  useEffect(() => {
    if (booking && booking.id && booking.id !== 0) {
      // Convert existing booking data to form format (remove space from AM/PM)
      const startTime = formatTime(new Date(booking.start)).replace(/\s+/g, '').toLowerCase();
      const endTime = formatTime(new Date(booking.end)).replace(/\s+/g, '').toLowerCase();
      
      setFormData({
        title: booking.title || "",
        description: booking.description || "",
        date: formatDateForForm(new Date(booking.start)),
        startTime,
        endTime,
        bookingType: booking.type || "production",
        status: booking.status || "confirmed",
        // severity: removed - production bookings don't use severity
        color: booking.color || "#3b82f6",
        templateId: booking.templateId?.toString() || "",
        templateName: "",
        pcrRoomId: booking.pcrRoomId?.toString() || "none",
        studioIds: booking.studioIds?.map((id: any) => id.toString()) || [booking.studioId?.toString()].filter(Boolean) || [],
        notifyList: booking.notifyList?.map((id: any) => id.toString()) || [],
        saveAsTemplate: false,
      });
    } else {
      setFormData(getDefaultFormData());
    }
  }, [booking, selectedDate, selectedStudio]);

  // Apply template (same logic as desktop)
  const handleTemplateChange = (templateId: string) => {
    updateFormField('templateId', templateId);
    
    if (templateId && templateId !== "none" && templateId !== "") {
      const selectedTemplate = templates.find(t => t.id.toString() === templateId);
      if (selectedTemplate) {
        // Apply template data using the same logic as desktop
        updateFormField('title', selectedTemplate.name);
        updateFormField('description', selectedTemplate.description || "");
        updateFormField('bookingType', selectedTemplate.type || "production");
        updateFormField('color', selectedTemplate.color || "#3b82f6");
        
        // Apply studio IDs (checking both formats like desktop)
        const studioIds = (selectedTemplate as any).studio_ids || selectedTemplate.studioIds || [];
        if (Array.isArray(studioIds) && studioIds.length > 0) {
          updateFormField('studioIds', studioIds.map(id => id.toString()));
        }
        
        // Apply PCR room
        const pcrRoomId = (selectedTemplate as any).pcr_room_id || selectedTemplate.pcrRoomId;
        if (pcrRoomId) {
          updateFormField('pcrRoomId', pcrRoomId.toString());
        }
        
        // Apply notification groups
        const notifyList = (selectedTemplate as any).notify_list || selectedTemplate.notifyList || [];
        if (Array.isArray(notifyList) && notifyList.length > 0) {
          updateFormField('notifyList', notifyList.map(id => id.toString()));
        }
        
        // Apply times if available and valid
        const startTime = (selectedTemplate as any).start_time || selectedTemplate.startTime;
        if (startTime && startTime.trim() !== "" && startTime.match(/^\d+:\d+[ap]m$/i)) {
          updateFormField('startTime', startTime);
        }
        
        const endTime = (selectedTemplate as any).end_time || selectedTemplate.endTime;
        if (endTime && endTime.trim() !== "" && endTime.match(/^\d+:\d+[ap]m$/i)) {
          updateFormField('endTime', endTime);
        }
      }
    }
  };

  // Toggle studio selection
  const handleStudioToggle = (studioId: string) => {
    const currentStudios = [...formData.studioIds];
    if (currentStudios.includes(studioId)) {
      updateFormField('studioIds', currentStudios.filter(id => id !== studioId));
    } else {
      updateFormField('studioIds', [...currentStudios, studioId]);
    }
  };

  // Toggle notification group
  const handleCrewToggle = (crewId: string) => {
    const currentNotifyList = [...formData.notifyList];
    if (currentNotifyList.includes(crewId)) {
      updateFormField('notifyList', currentNotifyList.filter(id => id !== crewId));
    } else {
      updateFormField('notifyList', [...currentNotifyList, crewId]);
    }
  };

  // Time validation - convert time strings to comparable format
  const validateTimes = () => {
    // Convert time strings to minutes for proper comparison
    const timeToMinutes = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const startMinutes = timeToMinutes(formData.startTime);
    const endMinutes = timeToMinutes(formData.endTime);

    if (startMinutes >= endMinutes) {
      showNotification({
        type: "error",
        title: "Invalid Time Range",
        message: "End time must be later than start time"
      });
      return false;
    }
    return true;
  };

  // Form submission (EXACT same logic as desktop BookingModal)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateTimes()) return;
    
    // Studio validation (same as desktop)
    if (formData.studioIds.length === 0) {
      showNotification({
        type: "error",
        title: "Error",
        message: "At least one studio must be selected"
      });
      return;
    }
    
    // Validate time fields before conversion
    if (!formData.startTime || !formData.endTime || 
        formData.startTime.trim() === "" || formData.endTime.trim() === "") {
      showNotification({
        type: "error",
        title: "Invalid Time",
        message: "Please select both start and end times"
      });
      return;
    }
    
    // Convert times to dates (same as desktop)
    const startDate = timeToDate(formData.date, formData.startTime);
    const endDate = timeToDate(formData.date, formData.endTime);
    
    // Convert notification group IDs from strings to numbers (same as desktop)
    const notifyListAsNumbers = formData.notifyList.map(id => parseInt(id));
    
    // Prepare booking data (EXACT same structure as desktop)
    const bookingData: Partial<InsertBooking> = {
      title: formData.title,
      description: formData.description,
      type: formData.bookingType,
      status: formData.status,
      start: startDate,
      end: endDate,
      notifyList: notifyListAsNumbers,
      color: formData.color,
      userId: 1,
    };
    
    // Set the primary studioId (same as desktop)
    if (formData.studioIds.length > 0) {
      bookingData.studioId = parseInt(formData.studioIds[0]);
    }
    
    // severity removed - production bookings don't use severity
    
    // Add templateId if selected (same as desktop)
    if (formData.templateId && formData.templateId !== "" && formData.templateId !== "none") {
      bookingData.templateId = parseInt(formData.templateId);
    } else {
      bookingData.templateId = null;
    }
    
    // Add pcrRoomId if selected (same as desktop)
    if (formData.pcrRoomId && formData.pcrRoomId !== "" && formData.pcrRoomId !== "none") {
      bookingData.pcrRoomId = parseInt(formData.pcrRoomId);
    } else {
      bookingData.pcrRoomId = null;
    }
    
    // Convert studioIds from strings to numbers (same as desktop)
    const studioIds = formData.studioIds.map(id => parseInt(id));
    
    try {
      if (booking && booking.id && booking.id !== 0) {
        // Update existing booking (EXACT same call as desktop)
        await updateBooking.mutateAsync({ 
          id: booking.id, 
          data: bookingData,
          studioIds: studioIds
        });
        
        showNotification({
          type: "success",
          title: "Success",
          message: studioIds.length > 1 
            ? `Booking updated successfully across ${studioIds.length} studios` 
            : "Booking updated successfully"
        });
      } else {
        // Create new booking (EXACT same call as desktop)
        const newBooking = await createBooking.mutateAsync({
          ...bookingData as InsertBooking,
          studioIds: studioIds
        });
        
        showNotification({
          type: "success",
          title: "Success", 
          message: studioIds.length > 1 
            ? `Booking created successfully across ${studioIds.length} studios` 
            : "Booking created successfully"
        });
        
        // Save as template if requested (same as desktop)
        if (formData.saveAsTemplate && formData.templateName) {
          const durationMs = endDate.getTime() - startDate.getTime();
          const durationMinutes = Math.floor(durationMs / 60000);
          const crewRequiredAsNumbers = formData.notifyList.map(id => parseInt(id));
          const studioIdsAsNumbers = formData.studioIds.map(id => parseInt(id));
          
          const additionalData = {
            studioIds: studioIdsAsNumbers,
            pcrRoomId: formData.pcrRoomId && formData.pcrRoomId !== "" ? parseInt(formData.pcrRoomId) : null,
            status: formData.status,
            color: formData.color,
          };
          
          const templateData = {
            name: formData.templateName,
            description: formData.description || "",
            type: formData.bookingType,
            duration: durationMinutes,
            crewRequired: crewRequiredAsNumbers,
            equipment: [additionalData],
            createdBy: 1
          };
          
          try {
            await createTemplate.mutateAsync(templateData);
            showNotification({
              type: "success",
              title: "Success",
              message: "Template saved successfully"
            });
          } catch (templateError) {
            showNotification({
              type: "warning",
              title: "Warning",
              message: "Booking was created but template could not be saved"
            });
          }
        }
      }
      
      // Reset form and close
      setFormData(getDefaultFormData());
      onClose();
    } catch (error) {
      console.error("Error saving booking:", error);
      showNotification({
        type: "error",
        title: "Error",
        message: `Failed to ${booking ? 'update' : 'create'} booking`
      });
    }
  };

  // Delete booking handler
  const handleDelete = async () => {
    if (!booking?.id) return;
    
    try {
      await deleteBooking.mutateAsync(booking.id);
      showNotification({
        type: "success",
        title: "Success",
        message: "Booking deleted successfully"
      });
      onClose();
    } catch (error) {
      showNotification({
        type: "error",
        title: "Error",
        message: "Failed to delete booking"
      });
    }
  };

  // Filter notification groups (same as desktop)
  const filteredNotificationGroups = notificationGroups.filter(group => 
    group.groupType !== 'site_management'
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {booking?.id ? "Edit Booking" : "Create Booking"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="title" className="text-sm font-medium">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => updateFormField('title', e.target.value)}
                placeholder="Booking title"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-sm font-medium">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateFormField('description', e.target.value)}
                placeholder="Booking description"
                className="mt-1 min-h-[60px]"
              />
            </div>
          </div>

          {/* Date and Time */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="date" className="text-sm font-medium">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => updateFormField('date', e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="start-time">Start Time</Label>
                <Select 
                  value={formData.startTime} 
                  onValueChange={(value) => updateFormField('startTime', value)} 
                  required
                >
                  <SelectTrigger id="start-time">
                    <SelectValue placeholder="Select start time" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {generateTimeOptions().map((time) => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="end-time">End Time</Label>
                <Select 
                  value={formData.endTime} 
                  onValueChange={(value) => updateFormField('endTime', value)} 
                  required
                >
                  <SelectTrigger id="end-time">
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
          </div>

          {/* Studios Selection */}
          <div>
            <Label className="text-sm font-medium">Studios</Label>
            <div className="grid grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto">
              {studios.map((studio) => (
                <div key={studio.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`studio-${studio.id}`}
                    checked={formData.studioIds.includes(studio.id.toString())}
                    onCheckedChange={() => handleStudioToggle(studio.id.toString())}
                  />
                  <Label htmlFor={`studio-${studio.id}`} className="text-xs cursor-pointer flex items-center gap-1">
                    <Camera className="h-3 w-3" />
                    {studio.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* PCR Room */}
          <div>
            <Label className="text-sm font-medium">PCR Room</Label>
            <Select 
              value={formData.pcrRoomId} 
              onValueChange={(value) => updateFormField('pcrRoomId', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select PCR room" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No PCR Room</SelectItem>
                {pcrRooms.map((room) => (
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

          {/* Template Selection */}
          <div>
            <Label className="text-sm font-medium">Template (Optional)</Label>
            <Select 
              value={formData.templateId} 
              onValueChange={handleTemplateChange}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select template (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Template</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id.toString()}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notification Groups */}
          <div>
            <Label className="text-sm font-medium">Notify Groups</Label>
            <div className="grid grid-cols-2 gap-2 mt-2 max-h-24 overflow-y-auto">
              {filteredNotificationGroups.map((group) => (
                <div key={group.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`group-${group.id}`}
                    checked={formData.notifyList.includes(group.id.toString())}
                    onCheckedChange={() => handleCrewToggle(group.id.toString())}
                  />
                  <Label htmlFor={`group-${group.id}`} className="text-xs cursor-pointer">
                    {group.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Booking Type and Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Type</Label>
              <Select 
                value={formData.bookingType} 
                onValueChange={(value) => updateFormField('bookingType', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="rehearsal">Rehearsal</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="alert">Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => updateFormField('status', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="tentative">Tentative</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Color */}
          <div>
            <Label className="text-sm font-medium">Color</Label>
            <Input
              type="color"
              value={formData.color}
              onChange={(e) => updateFormField('color', e.target.value)}
              className="mt-1 h-10"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4">
            {booking?.id && (
              <Button 
                type="button" 
                variant="destructive" 
                size="sm"
                onClick={handleDelete}
                className="flex items-center gap-1"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {booking?.id ? "Update" : "Create"} Booking
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}