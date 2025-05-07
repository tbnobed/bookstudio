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
import { Copy } from "lucide-react";
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
import CopyBookingModal from "./CopyBookingModal";

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
    color: "#4B83E2" // Default color for bookings (blue)
  };
  
  // State for form fields
  const [formData, setFormData] = useState({ ...defaultValues });
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  
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
          severity: booking.severity || "medium",
          color: booking.color || "#4B83E2" // Use booking color or default blue
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
            color: normalizedBooking.color || defaultValues.color // Use normalized booking color or default
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
      color: formData.color,
    };
    
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

  // Open copy booking modal
  const handleOpenCopyModal = () => {
    setIsCopyModalOpen(true);
  };

  // Close copy booking modal
  const handleCloseCopyModal = () => {
    setIsCopyModalOpen(false);
  };
  
  return (
    <div>
      {booking && !alertsOnly && (
        <CopyBookingModal 
          isOpen={isCopyModalOpen} 
          onClose={handleCloseCopyModal} 
          booking={booking}
        />
      )}
      
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
                  {/* Title - Full width */}
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
                  
                  {/* Main 3-column layout */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Left column - Studios selection */}
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
                    
                    {/* Middle column - Date and time */}
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="date">Date</Label>
                        <Input
                          id="date"
                          type="date"
                          value={formData.date}
                          onChange={(e) => updateFormField('date', e.target.value)}
                          required
                        />
                      </div>
                      
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
                    
                    {/* Right column - Booking configuration */}
                    <div className="space-y-3">
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
                  </div>
                  
                  {/* 2-column layout for color and crew notifications */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left column - Color picker */}
                    <div>
                      <Label htmlFor="color">Booking Color</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <input
                          type="color"
                          id="color"
                          value={formData.color}
                          onChange={(e) => updateFormField('color', e.target.value)}
                          className="w-12 h-8 rounded cursor-pointer"
                        />
                        <div className="flex-1">
                          <Input
                            value={formData.color}
                            onChange={(e) => updateFormField('color', e.target.value)}
                            className="font-mono"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Choose a color to help identify this booking in the calendar
                      </p>
                    </div>
                    
                    {/* Right column - Crew notifications */}
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
                  </div>
                  
                  {/* Full width - Description */}
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
                                <span>Deleting...</span>
                              ) : (
                                <span>Delete</span>
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={handleOpenCopyModal}
                        className="flex items-center"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </Button>
                    </div>
                    
                    <div className="space-x-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={onClose}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        disabled={updateBooking.isPending}
                      >
                        {updateBooking.isPending ? (
                          <span>Saving...</span>
                        ) : (
                          <span>Save Changes</span>
                        )}
                      </Button>
                    </div>
                  </DialogFooter>
                </form>
              </TabsContent>
              
              <TabsContent value="attachments" className="pt-4">
                <FileAttachmentList bookingId={booking.id} />
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
                  placeholder={alertsOnly ? "Enter alert title" : "Enter booking title"}
                  required
                />
              </div>
              
              {alertsOnly ? (
                // Alert-specific fields
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="type">Alert Type</Label>
                    <Select 
                      value={formData.bookingType} 
                      onValueChange={(value) => updateFormField('bookingType', value)} 
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="maintenance">Facility Maintenance</SelectItem>
                        <SelectItem value="it_support">IT Support</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="severity">Severity</Label>
                    <Select 
                      value={formData.severity} 
                      onValueChange={(value) => updateFormField('severity', value)} 
                      required
                    >
                      <SelectTrigger>
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
                </div>
              ) : (
                // Regular booking fields - 3-column layout
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Left column - Studios selection */}
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
                  
                  {/* Middle column - Date and time controls will be moved here later */}
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => updateFormField('date', e.target.value)}
                        required
                      />
                    </div>
                    
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
                  
                  {/* Right column - Booking configuration */}
                  <div className="space-y-3">
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
                </div>
              )}
              
              {/* Color picker for bookings */}
              {!alertsOnly && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="color">Booking Color</Label>
                    <div className="flex items-center mt-1">
                      <input
                        type="color"
                        id="color"
                        value={formData.color}
                        onChange={(e) => updateFormField('color', e.target.value)}
                        className="w-12 h-8 rounded cursor-pointer"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Choose a color to help identify this booking in the calendar
                    </p>
                  </div>
                </div>
              )}
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateFormField('description', e.target.value)}
                  placeholder={alertsOnly ? "Add details about this alert" : "Add details about this booking"}
                  rows={3}
                />
              </div>
              
              <div>
                <Label>Notify</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {alertsOnly ? (
                    // Alert notification options
                    ["Engineering", "Producers", "IT Support"].map((crew) => (
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
                    ))
                  ) : (
                    // Booking notification options
                    ["Camera Operators", "Sound Engineers", "Lighting Technicians", "Production Assistants", "Directors", "Engineering"].map((crew) => (
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
                    ))
                  )}
                </div>
              </div>
              
              {!alertsOnly && !booking && (
                <div className="space-y-2 border-t pt-4 mt-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="save-template"
                      checked={formData.saveAsTemplate}
                      onCheckedChange={(checked) => updateFormField('saveAsTemplate', checked)}
                    />
                    <Label
                      htmlFor="save-template"
                      className="font-medium"
                    >
                      Save as Template
                    </Label>
                  </div>
                  
                  {formData.saveAsTemplate && (
                    <div>
                      <Label htmlFor="template-name">Template Name</Label>
                      <Input
                        id="template-name"
                        value={formData.templateName}
                        onChange={(e) => updateFormField('templateName', e.target.value)}
                        placeholder="Enter a name for this template"
                        required={formData.saveAsTemplate}
                      />
                    </div>
                  )}
                </div>
              )}
              
              <DialogFooter className="pt-4">
                <div className="space-x-2">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createBooking.isPending}
                  >
                    {createBooking.isPending ? (
                      <span>Creating...</span>
                    ) : (
                      <span>{alertsOnly ? "Create Alert" : "Create Booking"}</span>
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}