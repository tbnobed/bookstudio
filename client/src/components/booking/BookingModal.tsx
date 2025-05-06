import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { Studio, Template, PcrRoom, InsertBooking } from "@shared/schema";
import { z } from "zod";
import { useStudioBookings } from "@/hooks/useStudioBookings";
import { formatTime, generateTimeOptions, timeToDate } from "@/lib/dateUtils";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { FileAttachmentList } from "./FileAttachmentList";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking?: any; // Optional existing booking for editing
  selectedDate?: Date;
  selectedStudio?: number;
  alertsOnly?: boolean; // If true, only maintenance and IT support options are available
}

export default function BookingModal({ 
  isOpen, 
  onClose, 
  booking, 
  selectedDate = new Date(),
  selectedStudio,
  alertsOnly = false
}: BookingModalProps) {
  const { toast } = useToast();
  const formInitializedRef = useRef(false);
  
  // Format date for form - using local date to avoid timezone issues
  const formatDateForForm = (date: Date): string => {
    // Create a new date to avoid reference issues
    const localDate = new Date(date);
    
    // Use local date components to create the formatted date string
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    
    console.log(`formatDateForForm: Input date: ${date.toISOString()}, formatted as: ${year}-${month}-${day}`);
    return `${year}-${month}-${day}`;
  };

  // Default form values
  const defaultValues = {
    title: "",
    description: "",
    studioId: selectedStudio?.toString() || "", // Keep for backward compatibility
    studioIds: selectedStudio ? [selectedStudio.toString()] : [] as string[], // Array for multiple studios
    pcrRoomId: "0",
    bookingType: alertsOnly ? "maintenance" : "production",
    date: formatDateForForm(selectedDate),
    startTime: "9:00am",
    endTime: "10:00am",
    templateId: "",
    notifyList: [] as string[],
    saveAsTemplate: false,
    templateName: "",
    severity: "medium", // low, medium, high, critical
    useMultiDateSelection: false // Flag to enable multi-date selection
  };
  
  // State for form fields
  const [formData, setFormData] = useState({ ...defaultValues });
  
  // State for multiple date selection
  const [selectedDates, setSelectedDates] = useState<Date[]>(selectedDate ? [selectedDate] : []);
  
  // Fetch studios
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });
  
  // Fetch PCR rooms
  const { data: pcrRooms = [] } = useQuery<PcrRoom[]>({
    queryKey: ["/api/pcr-rooms"],
  });

  // Get booking and template mutations
  const { 
    createBooking, 
    updateBooking, 
    deleteBooking, 
    createTemplate, 
    templates = [] 
  } = useStudioBookings();

  // Fetch linked studios for a booking (when editing)
  const fetchBookingStudios = async (bookingId: number) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/studios`);
      if (!response.ok) {
        console.error(`Error fetching linked studios for booking ${bookingId}: ${response.statusText}`);
        return [];
      }
      
      const studioData = await response.json();
      console.log(`Fetched linked studios for booking ${bookingId}:`, studioData);
      return studioData.map((studio: any) => studio.id.toString());
    } catch (error) {
      console.error(`Error fetching linked studios for booking ${bookingId}:`, error);
      return [];
    }
  };

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen && !formInitializedRef.current) {
      if (booking) {
        // Edit mode - populate form with booking data
        console.log("Populating form with booking data:", booking);
        
        // Create normalized booking object
        const normalizedBooking = {
          id: booking.id,
          title: booking.title || "",
          description: booking.description || "",
          studioId: (booking.studioId !== undefined 
            ? booking.studioId 
            : booking.studio_id) || null,
          pcrRoomId: (booking.pcrRoomId !== undefined 
            ? booking.pcrRoomId 
            : booking.pcr_room_id) || null,
          type: booking.type || "",
          start: booking.start,
          end: booking.end,
          templateId: (booking.templateId !== undefined 
            ? booking.templateId 
            : booking.template_id) || null,
          notifyList: (booking.notifyList !== undefined 
            ? booking.notifyList 
            : booking.notify_list) || [],
          severity: booking.severity || "medium"
        };
        
        // Clean all-day prefix from type
        const bookingType = normalizedBooking.type.replace("all-day:", "");
        
        // Format date and times - use local formatting to avoid timezone issues
        const bookingDate = new Date(normalizedBooking.start);
        const dateStr = formatDateForForm(bookingDate);
        const startTimeStr = formatTime(normalizedBooking.start).toLowerCase().replace(" ", "");
        const endTimeStr = formatTime(normalizedBooking.end).toLowerCase().replace(" ", "");
        
        console.log(`Booking ${normalizedBooking.id}: Original date ${normalizedBooking.start}, converted to form date ${dateStr}`);
        
        // Fetch linked studios for this booking
        const initializeFormWithStudios = async () => {
          // Default to main studioId
          let studioIds = normalizedBooking.studioId ? [normalizedBooking.studioId.toString()] : [];
          
          try {
            // Try to fetch linked studios from the junction table
            studioIds = await fetchBookingStudios(normalizedBooking.id);
            console.log(`Setting up form with linked studios:`, studioIds);
          } catch (error) {
            console.error("Error fetching linked studios:", error);
            // Fall back to the main studioId if there's an error
          }
          
          // Set form data with the fetched studio IDs
          setFormData({
            title: normalizedBooking.title,
            description: normalizedBooking.description,
            studioId: normalizedBooking.studioId ? normalizedBooking.studioId.toString() : "",
            studioIds: studioIds.length > 0 ? studioIds : [], 
            pcrRoomId: normalizedBooking.pcrRoomId ? normalizedBooking.pcrRoomId.toString() : "",
            bookingType,
            date: dateStr,
            startTime: startTimeStr,
            endTime: endTimeStr,
            templateId: normalizedBooking.templateId ? normalizedBooking.templateId.toString() : "",
            notifyList: normalizedBooking.notifyList,
            saveAsTemplate: false,
            templateName: "",
            severity: normalizedBooking.severity,
            useMultiDateSelection: false
          });
        };
        
        initializeFormWithStudios();
      } else {
        // Create mode - set defaults
        const newFormData = { ...defaultValues };
        
        // Set selected date if provided
        if (selectedDate) {
          newFormData.date = formatDateForForm(selectedDate);
          newFormData.startTime = "9:00am";
          newFormData.endTime = "10:00am";
        }
        
        // Set selected studio if provided
        if (selectedStudio) {
          newFormData.studioId = selectedStudio.toString();
          newFormData.studioIds = [selectedStudio.toString()];
        } else if (studios.length > 0) {
          // Set first studio as default if none selected
          newFormData.studioId = studios[0].id.toString();
          newFormData.studioIds = [studios[0].id.toString()];
        }
        
        setFormData(newFormData);
      }
      
      // Mark form as initialized
      formInitializedRef.current = true;
    }
  }, [isOpen, booking, selectedDate, selectedStudio, studios]);
  
  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      formInitializedRef.current = false;
    }
  }, [isOpen]);

  // Handle form field changes
  const updateFormField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle template selection
  const handleTemplateChange = (value: string) => {
    updateFormField('templateId', value);
    
    if (value && value !== "0") {
      const selectedTemplate = templates.find(t => t.id === parseInt(value));
      if (selectedTemplate) {
        // Pre-fill form with template data
        updateFormField('title', selectedTemplate.name);
        updateFormField('description', selectedTemplate.description || "");
        updateFormField('bookingType', selectedTemplate.type);
        
        // Calculate end time based on template duration
        const start = timeToDate(formData.date, formData.startTime);
        const end = new Date(start.getTime() + selectedTemplate.duration * 60000);
        
        // Format end time (12-hour format)
        let endHour = end.getHours();
        const endMinutes = end.getMinutes();
        const endPeriod = endHour >= 12 ? 'pm' : 'am';
        
        if (endHour > 12) {
          endHour -= 12;
        } else if (endHour === 0) {
          endHour = 12;
        }
        
        const newEndTime = `${endHour}:${endMinutes.toString().padStart(2, '0')}${endPeriod}`;
        updateFormField('endTime', newEndTime);
      }
    }
  };

  // Toggle crew notifications
  const handleCrewToggle = (crewId: string) => {
    const currentNotifyList = [...formData.notifyList];
    
    if (currentNotifyList.includes(crewId)) {
      updateFormField('notifyList', currentNotifyList.filter(id => id !== crewId));
    } else {
      updateFormField('notifyList', [...currentNotifyList, crewId]);
    }
  };
  
  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Studio validation
    if (formData.studioIds.length === 0 && (!alertsOnly || (alertsOnly && formData.bookingType !== "maintenance" && formData.bookingType !== "it_support"))) {
      toast({
        title: "Error",
        description: "At least one studio must be selected for this booking type",
        variant: "destructive"
      });
      return;
    }
    
    // Date validation for multi-date selection
    if (formData.useMultiDateSelection && selectedDates.length === 0) {
      toast({
        title: "Error",
        description: "At least one date must be selected when using multi-date selection",
        variant: "destructive"
      });
      return;
    }
    
    // Determine which dates to use
    const datesToProcess = formData.useMultiDateSelection 
      ? selectedDates 
      : [new Date(formData.date)];
    
    // Check if all-day booking
    let finalBookingType = formData.bookingType;
    if (booking && booking.type && booking.type.includes("all-day:")) {
      finalBookingType = `all-day:${formData.bookingType}`;
    }
    
    // Convert studioIds from strings to numbers
    const studioIds = formData.studioIds.map(id => parseInt(id));
    
    try {
      if (booking) {
        // For edit mode, just update the existing booking with the current date
        // Convert times to dates for the current booking
        const startDate = timeToDate(formData.date, formData.startTime);
        const endDate = timeToDate(formData.date, formData.endTime);
        
        // Prepare booking data
        const bookingData: Partial<InsertBooking> = {
          title: formData.title,
          description: formData.description,
          type: finalBookingType,
          start: startDate,
          end: endDate,
          notifyList: formData.notifyList,
        };
        
        // Set the primary studioId (for backward compatibility)
        if (formData.studioIds.length > 0) {
          bookingData.studioId = parseInt(formData.studioIds[0]);
        } else if (alertsOnly && (formData.bookingType === "maintenance" || formData.bookingType === "it_support")) {
          bookingData.studioId = null;
        }
        
        // Add severity for alerts
        if (alertsOnly) {
          bookingData.severity = formData.severity;
        }
        
        // Add templateId if selected
        if (formData.templateId && formData.templateId !== "0") {
          bookingData.templateId = parseInt(formData.templateId);
        } else {
          bookingData.templateId = null;
        }
        
        // Add pcrRoomId if selected
        if (formData.pcrRoomId && formData.pcrRoomId !== "0") {
          bookingData.pcrRoomId = parseInt(formData.pcrRoomId);
        } else {
          bookingData.pcrRoomId = null;
        }
        
        // Update existing booking
        console.log(`Updating booking ${booking.id} with studios:`, studioIds);
        
        await updateBooking.mutateAsync({ 
          id: booking.id, 
          data: bookingData,
          studioIds: studioIds
        });
        
        toast({
          title: "Success",
          description: studioIds.length > 1 
            ? `Booking updated successfully across ${studioIds.length} studios` 
            : "Booking updated successfully",
          variant: "default"
        });
      } else {
        // Create mode - handle multiple dates if needed
        let successCount = 0;
        
        // Create a booking for each selected date
        for (const currentDate of datesToProcess) {
          // Format the date string in YYYY-MM-DD format
          const dateStr = formatDateForForm(currentDate);
          
          // Convert times to dates for this specific date using UTC for consistent timezone handling
          const startDate = timeToDate(dateStr, formData.startTime);
          const endDate = timeToDate(dateStr, formData.endTime);
          
          console.log(`Creating booking - Date: ${dateStr}, Start time: ${formData.startTime}, End time: ${formData.endTime}`);
          console.log(`Converted to - Start: ${startDate.toISOString()}, End: ${endDate.toISOString()}`);
          
          // Prepare booking data
          const bookingData: Partial<InsertBooking> = {
            title: formData.title,
            description: formData.description,
            type: finalBookingType,
            start: startDate,
            end: endDate,
            notifyList: formData.notifyList,
          };
          
          // Set the primary studioId (for backward compatibility)
          if (formData.studioIds.length > 0) {
            bookingData.studioId = parseInt(formData.studioIds[0]);
          } else if (alertsOnly && (formData.bookingType === "maintenance" || formData.bookingType === "it_support")) {
            bookingData.studioId = null;
          }
          
          // Add severity for alerts
          if (alertsOnly) {
            bookingData.severity = formData.severity;
          }
          
          // Add templateId if selected
          if (formData.templateId && formData.templateId !== "0") {
            bookingData.templateId = parseInt(formData.templateId);
          } else {
            bookingData.templateId = null;
          }
          
          // Add pcrRoomId if selected
          if (formData.pcrRoomId && formData.pcrRoomId !== "0") {
            bookingData.pcrRoomId = parseInt(formData.pcrRoomId);
          } else {
            bookingData.pcrRoomId = null;
          }
          
          // Create new booking for this date
          console.log(`Creating new booking for date ${dateStr} with studios:`, studioIds);
          
          try {
            const newBooking = await createBooking.mutateAsync({
              ...bookingData as InsertBooking,
              studioIds: studioIds
            });
            successCount++;
          } catch (error: any) {
            console.error(`Failed to create booking for date ${dateStr}:`, error);
            // Show a toast with the error message if available
            toast({
              title: "Booking Error",
              description: error.message || `Failed to create booking for ${dateStr}`,
              variant: "destructive"
            });
            // Stop processing additional dates if we encounter an error
            break;
          }
        }
        
        // Show success message based on the number of dates processed
        if (successCount > 0) {
          const multipleDatesMsg = datesToProcess.length > 1 
            ? `Created ${successCount} bookings across ${datesToProcess.length} dates` 
            : "Booking created successfully";
            
          const multipleStudiosMsg = studioIds.length > 1 
            ? ` for ${studioIds.length} studios` 
            : "";
            
          toast({
            title: "Success", 
            description: multipleDatesMsg + multipleStudiosMsg,
            variant: "default"
          });
        } else {
          toast({
            title: "Error", 
            description: "Failed to create any bookings",
            variant: "destructive"
          });
        }
        
        // Save as template if requested
        if (formData.saveAsTemplate && formData.templateName) {
          // Calculate duration in minutes using the first date
          const firstDateStr = formatDateForForm(datesToProcess[0]);
          const startDate = timeToDate(firstDateStr, formData.startTime);
          const endDate = timeToDate(firstDateStr, formData.endTime);
          const durationMs = endDate.getTime() - startDate.getTime();
          const durationMinutes = Math.floor(durationMs / 60000);
          
          const templateData = {
            name: formData.templateName,
            description: formData.description,
            type: formData.bookingType,
            duration: durationMinutes,
            crewRequired: formData.notifyList,
            createdBy: 1 // Using 1 as admin for now
          };
          
          try {
            await createTemplate.mutateAsync(templateData);
            toast({
              title: "Success",
              description: "Template saved successfully",
              variant: "default"
            });
          } catch (templateError) {
            console.error("Error saving template:", templateError);
            toast({
              title: "Warning",
              description: "Booking was created but template could not be saved",
              variant: "destructive"
            });
          }
        }
      }
      
      // Reset form and close modal
      formInitializedRef.current = false;
      onClose();
    } catch (error) {
      console.error("Error submitting booking:", error);
      toast({
        title: "Error",
        description: "Failed to save booking",
        variant: "destructive"
      });
    }
  };

  // Render the modal
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {booking 
              ? (alertsOnly ? "Edit Alert" : "Edit Booking") 
              : (alertsOnly ? "New Alert" : "New Booking")
            }
          </DialogTitle>
        </DialogHeader>
        
        {booking && !alertsOnly ? (
          // Tabbed interface for existing bookings
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Booking Details</TabsTrigger>
              <TabsTrigger value="attachments">File Attachments</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="pt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => updateFormField('title', e.target.value)}
                    placeholder="Enter booking title"
                    required
                  />
                </div>
                
                {/* Studios section in its own full-width row */}
                <div className="mb-4">
                  <Label htmlFor="studio" className="flex items-center">
                    Studios <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <div className="border rounded-md p-2 mt-1 space-y-2 max-h-40 overflow-y-auto">
                    {studios.map((studio) => (
                      <div key={studio.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`studio-${studio.id}`} 
                          checked={formData.studioIds.includes(studio.id.toString())}
                          onCheckedChange={(checked) => {
                            const studioId = studio.id.toString();
                            let newStudioIds = [...formData.studioIds];
                            
                            if (checked) {
                              // Add studio to the list if not already included
                              if (!newStudioIds.includes(studioId)) {
                                newStudioIds.push(studioId);
                              }
                              // Also update main studioId for backward compatibility
                              updateFormField('studioId', studioId);
                            } else {
                              // Remove studio from the list
                              newStudioIds = newStudioIds.filter(id => id !== studioId);
                              
                              // Update main studioId if it was the one removed
                              if (formData.studioId === studioId) {
                                // Set to first selected studio or empty
                                const newMainStudio = newStudioIds.length > 0 ? newStudioIds[0] : "";
                                updateFormField('studioId', newMainStudio);
                              }
                            }
                            
                            updateFormField('studioIds', newStudioIds);
                          }}
                        />
                        <Label 
                          htmlFor={`studio-${studio.id}`}
                          className="text-sm cursor-pointer"
                        >
                          {studio.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {formData.studioIds.length === 0 && (
                    <p className="text-sm text-red-500 mt-1">At least one studio must be selected</p>
                  )}
                </div>
                
                {/* Booking Type and PCR Room on the same row */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label htmlFor="type">Booking Type</Label>
                    <Select 
                      value={formData.bookingType} 
                      onValueChange={(value) => updateFormField('bookingType', value)} 
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="production">Production</SelectItem>
                        <SelectItem value="rehearsal">Rehearsal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="pcrRoom">PCR Room (Optional)</Label>
                    <Select 
                      value={formData.pcrRoomId} 
                      onValueChange={(value) => updateFormField('pcrRoomId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">None</SelectItem>
                        {pcrRooms.map((pcrRoom) => (
                          <SelectItem key={pcrRoom.id} value={pcrRoom.id.toString()}>
                            {pcrRoom.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => updateFormField('date', e.target.value)}
                      required
                      disabled={formData.useMultiDateSelection}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="template">Template (Optional)</Label>
                    <Select 
                      value={formData.templateId} 
                      onValueChange={handleTemplateChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">None</SelectItem>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id.toString()}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Checkbox 
                      id="use-multi-date"
                      checked={formData.useMultiDateSelection}
                      onCheckedChange={(checked) => {
                        updateFormField('useMultiDateSelection', checked === true);
                        // Initialize selected dates with the currently selected date if toggling on
                        if (checked === true && selectedDates.length === 0) {
                          setSelectedDates([new Date(formData.date)]);
                        }
                      }}
                    />
                    <Label htmlFor="use-multi-date">Use multi-date selection</Label>
                  </div>
                  
                  {formData.useMultiDateSelection && (
                    <div className="border rounded-md p-1 mb-2 bg-background max-w-[250px] mx-auto">
                      <div className="flex items-center justify-between mb-1 px-1">
                        <Label className="text-xs font-medium">Select dates</Label>
                        <span className="text-xs text-muted-foreground">
                          {selectedDates.length} selected
                        </span>
                      </div>
                      <DayPicker
                        mode="multiple"
                        selected={selectedDates}
                        onSelect={(dates) => {
                          // Ensure we always have at least one date selected
                          setSelectedDates(dates || []);
                        }}
                        className="border-0 mx-auto p-0"
                        modifiersClassNames={{
                          selected: 'bg-primary text-primary-foreground rounded-full',
                          today: 'text-primary font-bold'
                        }}
                        showOutsideDays={false}
                        fixedWeeks
                        styles={{
                          caption: { marginBottom: '0.25rem' },
                          head: { fontSize: '0.7rem' },
                          root: { fontSize: '0.8rem', marginBottom: '-0.5rem' },
                          table: { width: '100%', maxWidth: '220px', margin: '0 auto' },
                          day: { width: '24px', height: '24px', margin: '1px' },
                          nav: { fontSize: '0.8rem' }
                        }}
                      />
                      <p className="text-xs text-muted-foreground mt-0 text-center px-1">
                        Creates a booking for each date.
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
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
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
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
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => updateFormField('description', e.target.value)}
                    placeholder="Add details about this booking"
                    rows={3}
                  />
                </div>
                
                <div>
                  <Label>Notify Crew</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {["Camera Operators", "Sound Engineers", "Lighting Technicians", "Production Assistants", "Directors", "Engineering"].map((crew) => (
                      <div key={crew} className="flex items-center space-x-2">
                        <Checkbox
                          id={`crew-${crew}`}
                          checked={formData.notifyList.includes(crew)}
                          onCheckedChange={() => handleCrewToggle(crew)}
                        />
                        <Label
                          htmlFor={`crew-${crew}`}
                          className="text-sm font-normal"
                        >
                          {crew}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <DialogFooter className="flex items-center justify-between pt-4">
                  <div className="flex items-center">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive" className="mr-2">
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the booking and remove it from the calendar.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={async () => {
                              try {
                                await deleteBooking.mutateAsync(booking.id);
                                onClose();
                              } catch (error) {
                                console.error('Failed to delete booking:', error);
                              }
                            }}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {deleteBooking.isPending ? (
                              <span className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Deleting...
                              </span>
                            ) : (
                              'Delete'
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button type="button" variant="outline" onClick={onClose}>
                      Cancel
                    </Button>
                  </div>
                  <Button 
                    type="submit" 
                    disabled={createBooking.isPending || updateBooking.isPending}
                  >
                    {(createBooking.isPending || updateBooking.isPending) ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </span>
                    ) : 'Update'}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
            
            <TabsContent value="attachments" className="py-4">
              <FileAttachmentList bookingId={booking.id} readOnly={false} />
            </TabsContent>
          </Tabs>
        ) : (
          // Regular form for new bookings or alerts
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => updateFormField('title', e.target.value)}
                placeholder="Enter booking title"
                required
              />
            </div>
            
            {/* Studios section in its own full-width row */}
            <div className="mb-4">
              <Label htmlFor="studio" className="flex items-center">
                Studios <span className="text-red-500 ml-1">*</span>
              </Label>
              <div className="border rounded-md p-2 mt-1 space-y-2 max-h-40 overflow-y-auto">
                {studios.map((studio) => (
                  <div key={studio.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`studio-${studio.id}`} 
                      checked={formData.studioIds.includes(studio.id.toString())}
                      onCheckedChange={(checked) => {
                        const studioId = studio.id.toString();
                        let newStudioIds = [...formData.studioIds];
                        
                        if (checked) {
                          // Add studio to the list if not already included
                          if (!newStudioIds.includes(studioId)) {
                            newStudioIds.push(studioId);
                          }
                          // Also update main studioId for backward compatibility
                          updateFormField('studioId', studioId);
                        } else {
                          // Remove studio from the list
                          newStudioIds = newStudioIds.filter(id => id !== studioId);
                          
                          // Update main studioId if it was the one removed
                          if (formData.studioId === studioId) {
                            // Set to first selected studio or empty
                            const newMainStudio = newStudioIds.length > 0 ? newStudioIds[0] : "";
                            updateFormField('studioId', newMainStudio);
                          }
                        }
                        
                        updateFormField('studioIds', newStudioIds);
                      }}
                    />
                    <Label 
                      htmlFor={`studio-${studio.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {studio.name}
                    </Label>
                  </div>
                ))}
              </div>
              {formData.studioIds.length === 0 && (
                <p className="text-sm text-red-500 mt-1">At least one studio must be selected</p>
              )}
            </div>
            
            {/* Booking Type and PCR Room on the same row */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="type">{alertsOnly ? "Alert Type" : "Booking Type"}</Label>
                <Select 
                  value={formData.bookingType} 
                  onValueChange={(value) => updateFormField('bookingType', value)} 
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {!alertsOnly ? (
                      <>
                        <SelectItem value="production">Production</SelectItem>
                        <SelectItem value="rehearsal">Rehearsal</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="it_support">IT Support</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              {!alertsOnly && (
                <div>
                  <Label htmlFor="pcrRoom">PCR Room (Optional)</Label>
                  <Select 
                    value={formData.pcrRoomId} 
                    onValueChange={(value) => updateFormField('pcrRoomId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">None</SelectItem>
                      {pcrRooms.map((pcrRoom) => (
                        <SelectItem key={pcrRoom.id} value={pcrRoom.id.toString()}>
                          {pcrRoom.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            
            {/* Severity field - only shown for alerts */}
            {alertsOnly && (
              <div>
                <Label htmlFor="severity">Severity</Label>
                <Select 
                  value={formData.severity} 
                  onValueChange={(value) => updateFormField('severity', value)} 
                  required
                >
                  <SelectTrigger id="severity">
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                        Low - Informational
                      </div>
                    </SelectItem>
                    <SelectItem value="medium">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-amber-500 mr-2"></div>
                        Medium - Planned Maintenance
                      </div>
                    </SelectItem>
                    <SelectItem value="high">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
                        High - Urgent Issue
                      </div>
                    </SelectItem>
                    <SelectItem value="critical">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                        Critical - Outage
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 mb-2">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => updateFormField('date', e.target.value)}
                  required
                  disabled={formData.useMultiDateSelection}
                />
              </div>
              
              <div>
                <Label htmlFor="template">Template (Optional)</Label>
                <Select 
                  value={formData.templateId} 
                  onValueChange={handleTemplateChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">None</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <Checkbox 
                  id="use-multi-date-new"
                  checked={formData.useMultiDateSelection}
                  onCheckedChange={(checked) => {
                    updateFormField('useMultiDateSelection', checked === true);
                    // Initialize selected dates with the currently selected date if toggling on
                    if (checked === true && selectedDates.length === 0) {
                      setSelectedDates([new Date(formData.date)]);
                    }
                  }}
                />
                <Label htmlFor="use-multi-date-new">Use multi-date selection</Label>
              </div>
              
              {formData.useMultiDateSelection && (
                <div className="border rounded-md p-1 mb-2 bg-background max-w-[250px] mx-auto">
                  <div className="flex items-center justify-between mb-1 px-1">
                    <Label className="text-xs font-medium">Select dates</Label>
                    <span className="text-xs text-muted-foreground">
                      {selectedDates.length} selected
                    </span>
                  </div>
                  <DayPicker
                    mode="multiple"
                    selected={selectedDates}
                    onSelect={(dates) => {
                      // Ensure we always have at least one date selected
                      setSelectedDates(dates || []);
                    }}
                    className="border-0 mx-auto p-0"
                    modifiersClassNames={{
                      selected: 'bg-primary text-primary-foreground rounded-full',
                      today: 'text-primary font-bold'
                    }}
                    showOutsideDays={false}
                    fixedWeeks
                    styles={{
                      caption: { marginBottom: '0.25rem' },
                      head: { fontSize: '0.7rem' },
                      root: { fontSize: '0.8rem', marginBottom: '-0.5rem' },
                      table: { width: '100%', maxWidth: '220px', margin: '0 auto' },
                      day: { width: '24px', height: '24px', margin: '1px' },
                      nav: { fontSize: '0.8rem' }
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-0 text-center px-1">
                    Creates a booking for each date.
                  </p>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
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
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
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
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateFormField('description', e.target.value)}
                placeholder="Add details about this booking"
                rows={3}
              />
            </div>
            
            <div>
              <Label>Notify Crew</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {["Camera Operators", "Sound Engineers", "Lighting Technicians", "Production Assistants", "Directors", "Engineering"].map((crew) => (
                  <div key={crew} className="flex items-center space-x-2">
                    <Checkbox
                      id={`crew-${crew}`}
                      checked={formData.notifyList.includes(crew)}
                      onCheckedChange={() => handleCrewToggle(crew)}
                    />
                    <Label
                      htmlFor={`crew-${crew}`}
                      className="text-sm font-normal"
                    >
                      {crew}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            
            {!booking && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="save-template"
                    checked={formData.saveAsTemplate}
                    onCheckedChange={(checked) => updateFormField('saveAsTemplate', checked === true)}
                  />
                  <Label
                    htmlFor="save-template"
                    className="text-sm font-normal"
                  >
                    Save as template
                  </Label>
                </div>
                
                {formData.saveAsTemplate && (
                  <div>
                    <Label htmlFor="template-name">Template Name</Label>
                    <Input
                      id="template-name"
                      value={formData.templateName}
                      onChange={(e) => updateFormField('templateName', e.target.value)}
                      placeholder="Enter template name"
                    />
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter className="flex items-center justify-between">
              <div className="flex items-center">
                {booking && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="destructive" className="mr-2">
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the 
                          {alertsOnly ? " alert" : " booking"} and remove it from the calendar.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            try {
                              await deleteBooking.mutateAsync(booking.id);
                              onClose();
                            } catch (error) {
                              console.error('Failed to delete booking:', error);
                            }
                          }}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {deleteBooking.isPending ? (
                            <span className="flex items-center">
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Deleting...
                            </span>
                          ) : (
                            'Delete'
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
              <Button 
                type="submit" 
                disabled={createBooking.isPending || updateBooking.isPending}
              >
                {(createBooking.isPending || updateBooking.isPending) ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : booking ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}