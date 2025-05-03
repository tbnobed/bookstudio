import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import { Studio, Template, InsertBooking } from "@shared/schema";
import { z } from "zod";
import { useStudioBookings } from "@/hooks/useStudioBookings";
import { formatTime, generateTimeOptions, timeToDate } from "@/lib/dateUtils";

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
  // State for form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [studioId, setStudioId] = useState<string>("");
  const [bookingType, setBookingType] = useState(alertsOnly ? "maintenance" : "production");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [notifyList, setNotifyList] = useState<string[]>([]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [severity, setSeverity] = useState("medium"); // low, medium, high, critical

  // Fetch data
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  // Booking mutation
  const { createBooking, updateBooking } = useStudioBookings();

  // Set initial form values
  useEffect(() => {
    if (isOpen) {
      if (booking) {
        // Edit mode - populate form with booking data
        setTitle(booking.title);
        setDescription(booking.description || "");
        setStudioId(booking.studioId.toString());
        setBookingType(booking.type);
        
        const bookingDate = new Date(booking.start);
        setDate(bookingDate.toISOString().split("T")[0]);
        setStartTime(formatTime(booking.start).toLowerCase().replace(" ", ""));
        setEndTime(formatTime(booking.end).toLowerCase().replace(" ", ""));
        
        setTemplateId(booking.templateId ? booking.templateId.toString() : "");
        setNotifyList(booking.notifyList || []);
      } else {
        // Create mode - set defaults
        resetForm();
        
        // Set selected date if provided
        if (selectedDate) {
          setDate(selectedDate.toISOString().split("T")[0]);
          
          // Set default times (9 AM - 10 AM)
          const defaultStart = new Date(selectedDate);
          defaultStart.setHours(9, 0, 0, 0);
          setStartTime("9:00am");
          
          const defaultEnd = new Date(selectedDate);
          defaultEnd.setHours(10, 0, 0, 0);
          setEndTime("10:00am");
        }
        
        // Set selected studio if provided
        if (selectedStudio) {
          setStudioId(selectedStudio.toString());
        } else if (studios.length > 0) {
          // Set first studio as default if none selected
          setStudioId(studios[0].id.toString());
        }
      }
    }
  }, [isOpen, booking, selectedDate, selectedStudio, studios]);

  // Reset form to defaults
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStudioId(selectedStudio?.toString() || "");
    setBookingType(alertsOnly ? "maintenance" : "production");
    setDate(selectedDate ? selectedDate.toISOString().split("T")[0] : "");
    setStartTime("9:00am");
    setEndTime("10:00am");
    setTemplateId("");
    setNotifyList([]);
    setSaveAsTemplate(false);
    setTemplateName("");
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Studio is required for regular bookings, but optional for facility-wide maintenance/IT alerts
    if (!studioId && (!alertsOnly || (alertsOnly && bookingType !== "maintenance" && bookingType !== "it_support"))) {
      // Highlight required fields and show error
      return;
    }
    
    // Convert times to date objects using our utility function
    const startDate = timeToDate(date, startTime);
    const endDate = timeToDate(date, endTime);
    
    const bookingData: Partial<InsertBooking> = {
      title,
      description,
      type: bookingType,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      notifyList: notifyList,
    };
    
    // Add studioId only if it's provided and valid
    if (studioId) {
      bookingData.studioId = parseInt(studioId);
    } else if (alertsOnly && (bookingType === "maintenance" || bookingType === "it_support")) {
      // Set to null explicitly for facility-wide maintenance/IT alerts
      bookingData.studioId = null;
    }
    
    // Add severity field for alerts
    if (alertsOnly) {
      bookingData.severity = severity;
    }
    
    if (templateId) {
      bookingData.templateId = parseInt(templateId);
    }
    
    if (booking) {
      // Update existing booking
      await updateBooking.mutateAsync({ id: booking.id, data: bookingData });
    } else {
      // Create new booking
      await createBooking.mutateAsync(bookingData as InsertBooking);
      
      // TODO: If saveAsTemplate is true, also save as a template
    }
    
    onClose();
  };

  // Handle template selection
  const handleTemplateChange = (value: string) => {
    setTemplateId(value);
    
    if (value && value !== "0") {
      const selectedTemplate = templates.find(t => t.id === parseInt(value));
      if (selectedTemplate) {
        // Pre-fill form with template data
        setTitle(selectedTemplate.name);
        setDescription(selectedTemplate.description || "");
        setBookingType(selectedTemplate.type);
        
        // Use our utility function to convert the time string to a Date object
        const start = timeToDate(date, startTime);
        
        // Calculate end time based on template duration (in minutes)
        const end = new Date(start.getTime() + selectedTemplate.duration * 60000);
        
        // Format end time in 12-hour format (e.g. 1:30pm)
        let endHour = end.getHours();
        const endMinutes = end.getMinutes();
        const endPeriod = endHour >= 12 ? 'pm' : 'am';
        
        if (endHour > 12) {
          endHour -= 12;
        } else if (endHour === 0) {
          endHour = 12;
        }
        
        setEndTime(`${endHour}:${endMinutes.toString().padStart(2, '0')}${endPeriod}`);
      }
    }
  };

  // Toggle crew notifications
  const handleCrewToggle = (crewId: string) => {
    if (notifyList.includes(crewId)) {
      setNotifyList(notifyList.filter(id => id !== crewId));
    } else {
      setNotifyList([...notifyList, crewId]);
    }
  };

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
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
                value={studioId} 
                onValueChange={setStudioId} 
                required
              >
                <SelectTrigger className={!studioId ? "border-red-500" : ""}>
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
              {!studioId && (
                <p className="text-sm text-red-500 mt-1">Studio selection is required</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="type">{alertsOnly ? "Alert Type" : "Booking Type"}</Label>
              <Select value={bookingType} onValueChange={setBookingType} required>
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
              <Select value={severity} onValueChange={setSeverity} required>
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
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="template">Template (Optional)</Label>
              <Select value={templateId} onValueChange={handleTemplateChange}>
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
              <Select value={startTime} onValueChange={setStartTime} required>
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
              <Select value={endTime} onValueChange={setEndTime} required>
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                    checked={notifyList.includes(crew)}
                    onCheckedChange={() => handleCrewToggle(crew)}
                  />
                  <label
                    htmlFor={`crew-${crew}`}
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {crew}
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          {!booking && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="save-template"
                checked={saveAsTemplate}
                onCheckedChange={(checked) => setSaveAsTemplate(!!checked)}
              />
              <label
                htmlFor="save-template"
                className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Save as template for future use
              </label>
            </div>
          )}
          
          {saveAsTemplate && (
            <div>
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Enter template name"
                required={saveAsTemplate}
              />
            </div>
          )}
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createBooking.isPending || updateBooking.isPending}>
              {createBooking.isPending || updateBooking.isPending ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : booking ? (
                alertsOnly ? "Update Alert" : "Update Booking"
              ) : (
                alertsOnly ? "Create Alert" : "Create Booking"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
