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
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/themes/light.css";

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
  
  // Format date for form - accounting for timezone issues
  const formatDateForForm = (date: Date): string => {
    // Create a date using the UTC components to avoid timezone shifts
    // This ensures that selecting "May 7" in the calendar keeps it as "May 7" in the form
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const formattedDate = `${year}-${month}-${day}`;
    console.log(`formatDateForForm: Input date: ${date.toISOString()}, formatted as: ${formattedDate}`);
    return formattedDate;
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
    dates: [] as string[], // Array for multiple dates
    startTime: "9:00am",
    endTime: "10:00am",
    templateId: "",
    notifyList: [] as string[],
    saveAsTemplate: false,
    templateName: "",
    severity: "medium" // low, medium, high, critical
  };
  
  // State for form fields
  const [formData, setFormData] = useState({ ...defaultValues });
  
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
            dates: [], // Initialize with empty array for existing bookings
            startTime: startTimeStr,
            endTime: endTimeStr,
            templateId: normalizedBooking.templateId ? normalizedBooking.templateId.toString() : "",
            notifyList: normalizedBooking.notifyList,
            saveAsTemplate: false,
            templateName: "",
            severity: normalizedBooking.severity
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
  
  // Handle adding a date to multi-date selection
  const handleAddDate = () => {
    // Only add the date if it's not already in the array
    if (!formData.dates.includes(formData.date)) {
      updateFormField('dates', [...formData.dates, formData.date].sort());
    }
  };
  
  // Handle removing a date from multi-date selection
  const handleRemoveDate = (dateToRemove: string) => {
    updateFormField('dates', formData.dates.filter(date => date !== dateToRemove));
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
    
    // Convert times to dates
    const startDate = timeToDate(formData.date, formData.startTime);
    const endDate = timeToDate(formData.date, formData.endTime);
    
    // Check if all-day booking
    let finalBookingType = formData.bookingType;
    if (booking && booking.type && booking.type.includes("all-day:")) {
      finalBookingType = `all-day:${formData.bookingType}`;
    }
    
    // Prepare booking data
    const bookingData: Partial<InsertBooking> = {
      title: formData.title,
      description: formData.description,
      type: finalBookingType,
      start: startDate,
      end: endDate,
      notifyList: formData.notifyList,
    };
    
    // Add dates array if multi-date selection is used
    if (formData.dates.length > 0) {
      bookingData.dates = formData.dates.map(date => date.toString());
    }
    
    // Set the primary studioId (for backward compatibility)
    // Use the first selected studio as the primary if available
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
    
    // Convert studioIds from strings to numbers
    const studioIds = formData.studioIds.map(id => parseInt(id));
    
    try {
      if (booking) {
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
        // Create new booking
        console.log(`Creating new booking with studios:`, studioIds);
        
        const newBooking = await createBooking.mutateAsync({
          ...bookingData as InsertBooking,
          studioIds: studioIds
        });
        
        toast({
          title: "Success", 
          description: studioIds.length > 1 
            ? `Booking created successfully across ${studioIds.length} studios` 
            : "Booking created successfully",
          variant: "default"
        });
        
        // Save as template if requested
        if (formData.saveAsTemplate && formData.templateName) {
          // Calculate duration in minutes
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
      <DialogContent className="sm:max-w-3xl">
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
                
                {/* Studios + Calendar section - Grid layout */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Left column: Studios selection */}
                  <div>
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
                  
                  {/* Right column: Date selection */}
                  <div>
                    <Label htmlFor="date">Date Selection</Label>
                    <div className="border rounded-md p-2 mt-1">
                      <DayPicker
                        mode="multiple"
                        selected={formData.dates.map(date => new Date(date))}
                        onSelect={(selectedDays) => {
                          if (selectedDays) {
                            // Convert the selected days to strings in the required format
                            const formattedDates = Array.from(selectedDays).map(date => 
                              formatDateForForm(date)
                            );
                            updateFormField('dates', formattedDates);
                            
                            // Also update the current date field for single date operations
                            if (formattedDates.length > 0) {
                              updateFormField('date', formattedDates[formattedDates.length - 1]);
                            }
                          } else {
                            updateFormField('dates', []);
                          }
                        }}
                        className="border-none p-0"
                        classNames={{
                          caption: "flex justify-center py-2 mb-1 relative items-center",
                          caption_label: "text-sm font-medium",
                          nav: "flex items-center",
                          nav_button: "h-6 w-6 bg-transparent p-0 opacity-75 hover:opacity-100",
                          nav_button_previous: "absolute left-1",
                          nav_button_next: "absolute right-1",
                          table: "w-full border-collapse",
                          head_row: "flex",
                          head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
                          row: "flex w-full mt-2",
                          cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                          day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100",
                          day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                          day_today: "bg-accent text-accent-foreground",
                          day_outside: "text-muted-foreground opacity-50",
                          day_disabled: "text-muted-foreground opacity-50",
                          day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                          day_hidden: "invisible",
                        }}
                        styles={{
                          caption: { margin: '0', padding: '0' },
                          month: { width: '100%' },
                        }}
                      />
                    </div>
                    
                    {/* Show selected dates */}
                    {formData.dates.length > 0 && (
                      <div className="mt-2 border rounded-md p-2 max-h-32 overflow-y-auto">
                        <p className="text-sm font-medium mb-1">Selected Dates:</p>
                        <div className="space-y-1">
                          {formData.dates.map(date => (
                            <div key={date} className="flex items-center justify-between text-sm bg-muted p-1 px-2 rounded">
                              <span>{new Date(date).toLocaleDateString()}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveDate(date)}
                                className="h-6 w-6 p-0"
                              >
                                &times;
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Three-column layout for booking options */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Column 1: Booking Type */}
                  <div>
                    <Label htmlFor="type">Booking Type</Label>
                    <Select 
                      value={formData.bookingType} 
                      onValueChange={(value) => updateFormField('bookingType', value)} 
                      required
                    >
                      <SelectTrigger id="type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {alertsOnly ? (
                          <>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="it_support">IT Support</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="production">Production</SelectItem>
                            <SelectItem value="rehearsal">Rehearsal</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Column 2: Template Selection */}
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
                  
                  {/* Column 3: PCR Room Selection or Severity */}
                  <div>
                    {alertsOnly ? (
                      <>
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
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>
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
            
            {/* Studios + Calendar section - Grid layout */}
            <div className="grid grid-cols-2 gap-4">
              {/* Left column: Studios selection */}
              <div>
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
              
              {/* Right column: Date selection */}
              <div>
                <Label htmlFor="date">Date Selection</Label>
                <div className="border rounded-md p-2 mt-1">
                  <div className="mb-2">
                    <Label htmlFor="datePicker" className="text-sm mb-1">Select dates:</Label>
                    <Flatpickr
                      options={{
                        mode: "multiple",
                        dateFormat: "Y-m-d",
                        defaultDate: formData.dates.length > 0 ? formData.dates.map(date => new Date(date)) : undefined,
                        onChange: (selectedDates, dateStr, instance) => {
                          console.log('Flatpickr selected dates:', selectedDates);
                          console.log('Flatpickr dateStr:', dateStr);
                          
                          // Convert the selected dates to strings in the YYYY-MM-DD format
                          const formattedDates = selectedDates.map(date => {
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            return `${year}-${month}-${day}`;
                          });
                          
                          console.log('Formatted dates from Flatpickr:', formattedDates);
                          
                          // Update the form data
                          updateFormField('dates', formattedDates);
                          
                          // Also update the current date field for single date operations
                          if (formattedDates.length > 0) {
                            updateFormField('date', formattedDates[formattedDates.length - 1]);
                          }
                        }
                      }}
                      className="w-full border p-2 rounded-md"
                      placeholder="Select dates"
                    />
                  </div>
                </div>
                
                {/* Show selected dates */}
                {formData.dates.length > 0 && (
                  <div className="mt-2 border rounded-md p-2 max-h-32 overflow-y-auto">
                    <p className="text-sm font-medium mb-1">Selected Dates:</p>
                    <div className="space-y-1">
                      {formData.dates.map(date => (
                        <div key={date} className="flex items-center justify-between text-sm bg-muted p-1 px-2 rounded">
                          <span>{new Date(date).toLocaleDateString()}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveDate(date)}
                            className="h-6 w-6 p-0"
                          >
                            &times;
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Three-column layout for booking options */}
            <div className="grid grid-cols-3 gap-4">
              {/* Column 1: Booking Type */}
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
              
              {/* Column 2: Template Selection */}
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
              
              {/* Column 3: PCR Room or Severity */}
              <div>
                {!alertsOnly ? (
                  <>
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
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
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