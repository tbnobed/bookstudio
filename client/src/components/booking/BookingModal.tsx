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
  // Debug the received props
  console.log("BookingModal - Props received:", {
    selectedStudio,
    hasPropBooking: !!booking,
    bookingId: booking?.id || 'none',
    isOpen
  });
  
  // Ensure selectedStudio is properly processed
  const studioIdStr = selectedStudio !== null && selectedStudio !== undefined
    ? selectedStudio.toString()
    : "";
  
  const studioIdsArray = studioIdStr
    ? [studioIdStr]
    : [] as string[];
  
  console.log("BookingModal - Studio selection:", {
    selectedStudio,
    studioIdStr,
    studioIdsArray
  });
  
  const defaultValues = {
    title: "",
    description: "",
    studioId: studioIdStr, // Keep for backward compatibility
    studioIds: studioIdsArray, // Array for multiple studios
    pcrRoomId: "0",
    bookingType: alertsOnly ? "maintenance" : "production",
    status: "confirmed", // confirmed, tentative, cancelled
    date: formatDateForForm(selectedDate),
    startTime: "9:00am",
    endTime: "10:00am",
    templateId: "",
    notifyList: [] as string[],
    saveAsTemplate: false,
    templateName: "",
    severity: "medium", // low, medium, high, critical
    color: booking ? booking.color : "#4B83E2" // Use booking color or default blue
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

  // Create dummy booking for new booking modal to use same code path
  const createDummyBooking = () => {
    // Calculate time range: default to 9am-10am
    const startTime = new Date(selectedDate);
    startTime.setHours(9, 0, 0, 0);
    
    const endTime = new Date(selectedDate);
    endTime.setHours(10, 0, 0, 0);
    
    // Select default studio
    const defaultStudioId = selectedStudio || (studios.length > 0 ? studios[0].id : null);
    
    return {
      id: 0, // Dummy ID for new booking
      title: "",
      description: "",
      studioId: defaultStudioId,
      studio_id: defaultStudioId,
      pcrRoomId: 0,
      pcr_room_id: 0,
      type: alertsOnly ? "maintenance" : "production",
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      templateId: 0,
      template_id: 0,
      notifyList: [],
      notify_list: [],
      severity: "medium",
      status: "confirmed",
      color: booking ? booking.color : "#4B83E2" // Use booking color or default blue
    };
  };
  
  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen && !formInitializedRef.current) {
      // Use actual booking for edit mode or create a dummy booking for new mode
      const bookingToUse = booking || createDummyBooking();
      
      console.log("Populating form with booking data:", bookingToUse);
      
      // Create normalized booking object
      const normalizedBooking = {
        id: bookingToUse.id,
        title: bookingToUse.title || "",
        description: bookingToUse.description || "",
        studioId: (bookingToUse.studioId !== undefined 
          ? bookingToUse.studioId 
          : bookingToUse.studio_id) || null,
        pcrRoomId: (bookingToUse.pcrRoomId !== undefined 
          ? bookingToUse.pcrRoomId 
          : bookingToUse.pcr_room_id) || null,
        type: bookingToUse.type || "",
        status: bookingToUse.status || "confirmed",
        start: bookingToUse.start,
        end: bookingToUse.end,
        templateId: (bookingToUse.templateId !== undefined 
          ? bookingToUse.templateId 
          : bookingToUse.template_id) || null,
        notifyList: (bookingToUse.notifyList !== undefined 
          ? bookingToUse.notifyList 
          : bookingToUse.notify_list) || [],
        severity: bookingToUse.severity || "medium",
        color: bookingToUse.color || (booking ? booking.color : "#4B83E2") // Use booking color or default blue
      };
      
      // Clean all-day prefix from type
      const bookingType = normalizedBooking.type.replace("all-day:", "");
      
      // Format date and times - use local formatting to avoid timezone issues
      const bookingDate = new Date(normalizedBooking.start);
      const dateStr = formatDateForForm(bookingDate);
      const startTimeStr = formatTime(normalizedBooking.start).toLowerCase().replace(" ", "");
      const endTimeStr = formatTime(normalizedBooking.end).toLowerCase().replace(" ", "");
      
      // For debugging
      if (booking) {
        console.log(`Booking ${normalizedBooking.id}: Original date ${normalizedBooking.start}, converted to form date ${dateStr}`);
      }
      
      // Initialize the form with studios
      const initializeFormWithStudios = async () => {
        // Default to main studioId (or selectedStudio) as an array
        let studioIds = [];
        
        if (booking) {
          // For edit mode: try to fetch linked studios 
          try {
            studioIds = await fetchBookingStudios(normalizedBooking.id);
            console.log(`Setting up form with linked studios:`, studioIds);
          } catch (error) {
            console.error("Error fetching linked studios:", error);
            // Fall back to the main studioId
            studioIds = normalizedBooking.studioId ? [normalizedBooking.studioId.toString()] : [];
          }
        } else {
          // For new booking mode: use selectedStudio or first available
          console.log("New booking mode - selectedStudio:", selectedStudio);
          studioIds = selectedStudio 
            ? [selectedStudio.toString()]
            : (studios.length > 0 ? [studios[0].id.toString()] : []);
        }
        
        // Set form data with consistent initialization for both new and edit modes
        setFormData({
          title: normalizedBooking.title,
          description: normalizedBooking.description,
          studioId: normalizedBooking.studioId ? normalizedBooking.studioId.toString() : "",
          studioIds: studioIds.length > 0 ? studioIds : [], 
          pcrRoomId: normalizedBooking.pcrRoomId ? normalizedBooking.pcrRoomId.toString() : "0", // Use "0" as default
          bookingType,
          status: normalizedBooking.status || "confirmed",
          date: dateStr,
          startTime: startTimeStr,
          endTime: endTimeStr,
          templateId: normalizedBooking.templateId ? normalizedBooking.templateId.toString() : "0", // Use "0" as default
          notifyList: normalizedBooking.notifyList,
          saveAsTemplate: false,
          templateName: "",
          severity: normalizedBooking.severity,
          color: normalizedBooking.color || defaultValues.color
        });
      };
      
      // Initialize form with studios (both for new and edit mode)
      initializeFormWithStudios();
      
      // Mark form as initialized
      formInitializedRef.current = true;
    }
  }, [isOpen, booking, selectedDate, selectedStudio, studios, alertsOnly]);
  
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
      status: formData.status,
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
      // Check if it's a valid existing booking (booking exists and has a non-zero ID)
      if (booking && booking.id && booking.id !== 0) {
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
      
      // Try to get more detailed error message
      let errorMsg = "Failed to save booking";
      if (error instanceof Error) {
        errorMsg = error.message;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMsg = String(error.message);
      }
      
      // Display the detailed error message
      toast({
        title: "Error",
        description: errorMsg,
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
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {booking && booking.id > 0
                ? (alertsOnly ? "Edit Alert" : "Edit Booking") 
                : (alertsOnly ? "New Alert" : "New Booking")
              }
            </DialogTitle>
          </DialogHeader>
        
          {!alertsOnly ? (
            // Tabbed interface for standard bookings (both new and edit)
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
                  
                  {/* Description - Full width */}
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => updateFormField('description', e.target.value)}
                      placeholder="Enter booking details"
                      rows={3}
                    />
                  </div>
                  
                  {/* 3-column grid for form controls */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Left column - Studios */}
                    <div>
                      <div className="space-y-4">
                        <div>
                          <Label>Studios</Label>
                          <div className="flex flex-col mt-2 space-y-2">
                            {studios.map((studio) => (
                              <div key={studio.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`studio-${studio.id}`}
                                  checked={formData.studioIds.includes(studio.id.toString())}
                                  onCheckedChange={(checked) => {
                                    const studioId = studio.id.toString();
                                    if (checked) {
                                      updateFormField('studioIds', [...formData.studioIds, studioId]);
                                    } else {
                                      updateFormField('studioIds', formData.studioIds.filter(id => id !== studioId));
                                    }
                                  }}
                                />
                                <Label
                                  htmlFor={`studio-${studio.id}`}
                                  className="cursor-pointer"
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
                      </div>
                    </div>
                    
                    {/* Middle column - Date and time */}
                    <div>
                      <div className="space-y-4">
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
                    </div>
                    
                    {/* Right column - Booking configuration */}
                    <div>
                      <div className="space-y-4">
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
                              <SelectItem value="maintenance">Maintenance</SelectItem>
                              <SelectItem value="it_support">IT Support</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label htmlFor="status">Booking Status</Label>
                          <Select 
                            value={formData.status} 
                            onValueChange={(value) => updateFormField('status', value)} 
                            required
                          >
                            <SelectTrigger id="status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="confirmed">Confirmed</SelectItem>
                              <SelectItem value="tentative">Tentative</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
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
                              <SelectItem value="none">None</SelectItem>
                              {templates.map((template) => (
                                <SelectItem key={template.id} value={template.id.toString()}>
                                  {template.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {!alertsOnly && (
                          <div>
                            <Label htmlFor="color">Booking Color</Label>
                            <div className="flex items-center mt-1.5">
                              <Input
                                id="color"
                                type="color"
                                value={formData.color}
                                onChange={(e) => updateFormField('color', e.target.value)}
                                className="w-16 h-8 p-1 mr-2"
                              />
                              <span className="text-xs text-muted-foreground">
                                Custom color for calendar display
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {alertsOnly && (
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
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <DialogFooter className="pt-4">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex space-x-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" type="button" size="sm" className="text-red-500">
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the booking.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-500 hover:bg-red-600"
                                onClick={() => {
                                  deleteBooking.mutate(booking.id, {
                                    onSuccess: () => {
                                      toast({
                                        title: "Success",
                                        description: "Booking deleted successfully",
                                        variant: "default"
                                      });
                                      onClose();
                                    },
                                    onError: (error) => {
                                      toast({
                                        title: "Error",
                                        description: "Failed to delete booking",
                                        variant: "destructive"
                                      });
                                    }
                                  });
                                }}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        
                        <Button 
                          onClick={handleOpenCopyModal} 
                          variant="outline" 
                          type="button" 
                          size="sm" 
                          className="space-x-1"
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          <span>Copy Booking</span>
                        </Button>
                      </div>
                      
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
                {booking ? (
                  <FileAttachmentList bookingId={booking.id} />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <p className="text-muted-foreground mb-2">
                      File attachments will be available after creating this booking.
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Save the booking first, then you can attach files.
                    </p>
                  </div>
                )}
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
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateFormField('description', e.target.value)}
                  placeholder={alertsOnly ? "Enter alert details" : "Enter booking details"}
                  rows={3}
                />
              </div>
              
              {/* 3-column grid for form controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Left column - Studios */}
                <div>
                  <div className="space-y-4">
                    {(!alertsOnly || (alertsOnly && formData.bookingType !== "maintenance" && formData.bookingType !== "it_support")) && (
                      <div>
                        <Label>Studios</Label>
                        <div className="flex flex-col mt-2 space-y-2">
                          {studios.map((studio) => (
                            <div key={studio.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`studio-${studio.id}`}
                                checked={formData.studioIds.includes(studio.id.toString())}
                                onCheckedChange={(checked) => {
                                  const studioId = studio.id.toString();
                                  if (checked) {
                                    updateFormField('studioIds', [...formData.studioIds, studioId]);
                                  } else {
                                    updateFormField('studioIds', formData.studioIds.filter(id => id !== studioId));
                                  }
                                }}
                              />
                              <Label
                                htmlFor={`studio-${studio.id}`}
                                className="cursor-pointer"
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
                    )}
                  </div>
                </div>
                
                {/* Middle column - Date and time */}
                <div>
                  <div className="space-y-4">
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
                </div>
                
                {/* Right column - Booking configuration */}
                <div>
                  <div className="space-y-4">
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
                          {alertsOnly ? (
                            <>
                              <SelectItem value="maintenance">Maintenance</SelectItem>
                              <SelectItem value="it_support">IT Support</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="production">Production</SelectItem>
                              <SelectItem value="rehearsal">Rehearsal</SelectItem>
                              <SelectItem value="maintenance">Maintenance</SelectItem>
                              <SelectItem value="it_support">IT Support</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
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
                    
                    {!alertsOnly && (
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
                            <SelectItem value="none">None</SelectItem>
                            {templates.map((template) => (
                              <SelectItem key={template.id} value={template.id.toString()}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {!alertsOnly && (
                      <div>
                        <Label htmlFor="color">Booking Color</Label>
                        <div className="flex items-center mt-1.5">
                          <Input
                            id="color"
                            type="color"
                            value={formData.color}
                            onChange={(e) => updateFormField('color', e.target.value)}
                            className="w-16 h-8 p-1 mr-2"
                          />
                          <span className="text-xs text-muted-foreground">
                            Custom color for calendar display
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {alertsOnly && (
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
                    )}
                  </div>
                </div>
              </div>
              
              {!alertsOnly && (
                <div className="flex flex-row items-start space-x-2 pt-2">
                  <Checkbox
                    id="save-template"
                    checked={formData.saveAsTemplate}
                    onCheckedChange={(checked) => updateFormField('saveAsTemplate', checked)}
                  />
                  <Label
                    htmlFor="save-template"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Save as template for future bookings
                  </Label>
                </div>
              )}
              
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
              
              <DialogFooter className="flex items-center justify-between pt-4">
                <div>
                  {/* Left side empty for alignment */}
                </div>
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
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}