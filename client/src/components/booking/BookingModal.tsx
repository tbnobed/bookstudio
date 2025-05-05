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
import { Studio, Template, InsertBooking } from "@shared/schema";
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
  
  // Format date for form
  const formatDateForForm = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Default form values
  const defaultValues = {
    title: "",
    description: "",
    studioId: selectedStudio?.toString() || "",
    bookingType: alertsOnly ? "maintenance" : "production",
    date: formatDateForForm(selectedDate),
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

  // Get booking and template mutations
  const { 
    createBooking, 
    updateBooking, 
    deleteBooking, 
    createTemplate, 
    templates = [] 
  } = useStudioBookings();

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
        
        // Format date and times
        const bookingDate = new Date(normalizedBooking.start);
        const dateStr = bookingDate.toISOString().split("T")[0];
        const startTimeStr = formatTime(normalizedBooking.start).toLowerCase().replace(" ", "");
        const endTimeStr = formatTime(normalizedBooking.end).toLowerCase().replace(" ", "");
        
        // Set form data
        setFormData({
          title: normalizedBooking.title,
          description: normalizedBooking.description,
          studioId: normalizedBooking.studioId ? normalizedBooking.studioId.toString() : "",
          bookingType,
          date: dateStr,
          startTime: startTimeStr,
          endTime: endTimeStr,
          templateId: normalizedBooking.templateId ? normalizedBooking.templateId.toString() : "",
          notifyList: normalizedBooking.notifyList,
          saveAsTemplate: false,
          templateName: "",
          severity: normalizedBooking.severity
        });
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
        } else if (studios.length > 0) {
          // Set first studio as default if none selected
          newFormData.studioId = studios[0].id.toString();
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
    if (!formData.studioId && (!alertsOnly || (alertsOnly && formData.bookingType !== "maintenance" && formData.bookingType !== "it_support"))) {
      toast({
        title: "Error",
        description: "Studio selection is required for this booking type",
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
    
    // Add studioId if provided
    if (formData.studioId) {
      bookingData.studioId = parseInt(formData.studioId);
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
    
    try {
      if (booking) {
        // Update existing booking
        await updateBooking.mutateAsync({ id: booking.id, data: bookingData });
        toast({
          title: "Success",
          description: "Booking updated successfully",
          variant: "default"
        });
      } else {
        // Create new booking
        const newBooking = await createBooking.mutateAsync(bookingData as InsertBooking);
        toast({
          title: "Success", 
          description: "Booking created successfully",
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
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="studio" className="flex items-center">
                      Studio <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <Select 
                      value={formData.studioId} 
                      onValueChange={(value) => updateFormField('studioId', value)} 
                      required
                    >
                      <SelectTrigger className={!formData.studioId ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select studio" />
                      </SelectTrigger>
                      <SelectContent>
                        {studios.map((studio) => (
                          <SelectItem key={studio.id} value={studio.id.toString()}>
                            {studio.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!formData.studioId && (
                      <p className="text-sm text-red-500 mt-1">Studio selection is required</p>
                    )}
                  </div>
                  
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
                </div>
                
                <div className="grid grid-cols-2 gap-4">
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
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="studio" className="flex items-center">
                  Studio <span className="text-red-500 ml-1">*</span>
                </Label>
                <Select 
                  value={formData.studioId} 
                  onValueChange={(value) => updateFormField('studioId', value)} 
                  required
                >
                  <SelectTrigger className={!formData.studioId ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select studio" />
                  </SelectTrigger>
                  <SelectContent>
                    {studios.map((studio) => (
                      <SelectItem key={studio.id} value={studio.id.toString()}>
                        {studio.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!formData.studioId && (
                  <p className="text-sm text-red-500 mt-1">Studio selection is required</p>
                )}
              </div>
              
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
            
            <div className="grid grid-cols-2 gap-4">
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