import { useState, useEffect } from "react";
import { useAlerts } from "@/hooks/useAlerts";
import { InsertAlert } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useNotification } from "@/hooks/use-notification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Trash2, CalendarIcon, X } from "lucide-react";
import { generateTimeOptions, timeToDate } from "@/lib/dateUtils";
import { getFacilityTimezone } from "@/lib/timezoneConfig";
import { startOfDay, endOfDay, parseISO, format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { queryClient } from "@/lib/queryClient";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert?: any; // Optional existing alert for editing
  selectedDate?: Date;
  alertsOnly?: boolean; // When true, forces alert-type creation
}

export default function AlertModal({ 
  isOpen, 
  onClose, 
  alert, 
  selectedDate,
  alertsOnly = false
}: AlertModalProps) {
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [alertType, setAlertType] = useState("maintenance");
  const [severity, setSeverity] = useState("medium");
  const [date, setDate] = useState("");
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [startTime, setStartTime] = useState("9:00am");
  const [endTime, setEndTime] = useState("10:00am");
  const [isAllDay, setIsAllDay] = useState(false);
  const [notifyList, setNotifyList] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Alert mutations
  const { createAlert, createBulkAlerts, updateAlert, deleteAlert } = useAlerts();
  const { toast } = useToast();
  const { showNotification } = useNotification();

  // Set initial form values
  useEffect(() => {
    if (isOpen) {
      if (alert) {
        // Edit mode - populate form with alert data
        setTitle(alert.title);
        setDescription(alert.description || "");
        setAlertType(alert.alertType);
        setSeverity(alert.severity || "medium");
        
        // Convert alert times to facility timezone for proper display
        const facilityTimezone = getFacilityTimezone();
        console.log("AlertModal - Edit mode alert data:", {
          title: alert.title,
          start: alert.start,
          end: alert.end,
          facilityTimezone
        });
        
        // Convert UTC times to facility timezone using proper date-fns-tz
        const utcStartTime = new Date(alert.start);
        const utcEndTime = new Date(alert.end);
        const facilityStartTime = toZonedTime(utcStartTime, facilityTimezone);
        const facilityEndTime = toZonedTime(utcEndTime, facilityTimezone);
        
        // Format the date for the date input (YYYY-MM-DD format) - use Intl for consistent results
        const dateFormatter = new Intl.DateTimeFormat('en-CA', { 
          timeZone: facilityTimezone,
          year: 'numeric',
          month: '2-digit', 
          day: '2-digit'
        });
        const facilityDateStr = dateFormatter.format(utcStartTime);
        
        console.log("AlertModal - Converted times:", {
          utcStart: utcStartTime.toISOString(),
          utcEnd: utcEndTime.toISOString(),
          facilityStartTime: facilityStartTime.toISOString(),
          facilityEndTime: facilityEndTime.toISOString(),
          facilityDateStr,
          facilityTimezone
        });
        
        // Set date based on facility timezone
        setDate(facilityDateStr);
        
        // Parse times using facility timezone
        const startHours = facilityStartTime.getHours();
        const startMinutes = facilityStartTime.getMinutes();
        const startPeriod = startHours >= 12 ? "pm" : "am";
        const formattedStartHours = startHours > 12 ? startHours - 12 : (startHours === 0 ? 12 : startHours);
        const formattedStartTime = `${formattedStartHours}:${startMinutes.toString().padStart(2, "0")}${startPeriod}`;
        setStartTime(formattedStartTime);
        
        const endHours = facilityEndTime.getHours();
        const endMinutes = facilityEndTime.getMinutes();
        const endPeriod = endHours >= 12 ? "pm" : "am";
        const formattedEndHours = endHours > 12 ? endHours - 12 : (endHours === 0 ? 12 : endHours);
        const formattedEndTime = `${formattedEndHours}:${endMinutes.toString().padStart(2, "0")}${endPeriod}`;
        setEndTime(formattedEndTime);
        
        console.log("AlertModal - Formatted times:", {
          formattedStartTime,
          formattedEndTime,
          originalStartHours: startHours,
          originalEndHours: endHours
        });
        
        // Check if this is an all-day alert using facility timezone (reuse existing variables)
        const startHoursFacility = facilityStartTime.getHours();
        const startMinutesFacility = facilityStartTime.getMinutes();
        const endHoursFacility = facilityEndTime.getHours();
        const endMinutesFacility = facilityEndTime.getMinutes();
        
        // If start is 00:00 and end is 23:59 in facility timezone, it's an all-day alert
        const isStartMidnight = startHoursFacility === 0 && startMinutesFacility === 0;
        const isEndBeforeMidnight = endHoursFacility === 23 && endMinutesFacility === 59;
        
        console.log("All-day detection:", {
          alertTitle: alert.title,
          facilityTimezone,
          startUTC: alert.start,
          endUTC: alert.end,
          startFacility: facilityStartTime.toISOString(),
          endFacility: facilityEndTime.toISOString(),
          startHoursFacility,
          startMinutesFacility,
          endHoursFacility,
          endMinutesFacility,
          isStartMidnight,
          isEndBeforeMidnight,
          isAllDay: isStartMidnight && isEndBeforeMidnight
        });
        
        setIsAllDay(isStartMidnight && isEndBeforeMidnight);
        
        setNotifyList(alert.notifyList || []);
      } else {
        // Create mode - set defaults
        resetForm();
        
        // Set selected date if provided, using facility timezone
        if (selectedDate) {
          const facilityTimezone = getFacilityTimezone();
          const dateFormatter = new Intl.DateTimeFormat('en-CA', { 
            timeZone: facilityTimezone,
            year: 'numeric',
            month: '2-digit', 
            day: '2-digit'
          });
          const facilityDateStr = dateFormatter.format(selectedDate);
          setDate(facilityDateStr);
          setSelectedDates([selectedDate]);
          console.log("AlertModal - Setting date for new alert:", {
            selectedDate: selectedDate.toISOString(),
            facilityTimezone,
            facilityDateStr
          });
        } else {
          setSelectedDates([new Date()]);
        }
      }
    }
  }, [isOpen, alert, selectedDate]);

  // Reset form to defaults
  const resetForm = () => {
    setTitle("");
    setDescription("");
    
    // If alertsOnly is true, set defaults specifically for alerts
    // This ensures that when the "Add Alert" button is clicked, 
    // we create a proper alert that will show in the alerts section
    if (alertsOnly) {
      setAlertType("maintenance");  // Default alert type 
      setSeverity("medium");        // Default severity (not forcing critical)
      setIsAllDay(false);           // Allow user to choose if it's all-day or not
      console.log("Setting up alert defaults with medium severity");
    } else {
      setAlertType("maintenance");
      setSeverity("medium");
      setIsAllDay(false);
    }
    
    // Set date using facility timezone if selectedDate is available, otherwise current date
    if (selectedDate) {
      const facilityTimezone = getFacilityTimezone();
      const dateFormatter = new Intl.DateTimeFormat('en-CA', { 
        timeZone: facilityTimezone,
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit'
      });
      setDate(dateFormatter.format(selectedDate));
      setSelectedDates([selectedDate]);
    } else {
      // Default to current date in facility timezone
      const facilityTimezone = getFacilityTimezone();
      const dateFormatter = new Intl.DateTimeFormat('en-CA', { 
        timeZone: facilityTimezone,
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit'
      });
      setDate(dateFormatter.format(new Date()));
      setSelectedDates([new Date()]);
    }
    setStartTime("9:00am");
    setEndTime("10:00am");
    setNotifyList([]);
    setDatePickerOpen(false);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that at least one date is selected for new alerts
    if (!alert && selectedDates.length === 0) {
      showNotification({
        type: "error",
        title: "No Dates Selected",
        message: "Please select at least one date for the alert.",
      });
      return;
    }
    
    // Validate that end time is not earlier than start time (only for non-all-day alerts)
    if (!isAllDay) {
      const testDate = alert ? date : format(selectedDates[0], 'yyyy-MM-dd');
      const startDate = timeToDate(testDate, startTime);
      const endDate = timeToDate(testDate, endTime);
      
      if (endDate <= startDate) {
        showNotification({
          type: "error",
          title: "Invalid Time Range",
          message: "End time must be after start time. Please choose an end time that comes after the start time.",
        });
        return;
      }
    }
    
    let localStartDate, localEndDate;
    let finalAlertType = alertType; // Create a mutable copy of alertType
    
    if (isAllDay) {
      // Handle all-day alert - use proper facility timezone handling
      const facilityTimezone = getFacilityTimezone();
      
      // Parse the date string (YYYY-MM-DD format)
      const [year, month, day] = date.split('-').map(Number);
      
      // Create start and end of day in facility timezone using the timezone-aware constructor
      const facilityStartOfDay = new Date();
      facilityStartOfDay.setFullYear(year, month - 1, day); // month is 0-indexed
      facilityStartOfDay.setHours(0, 0, 0, 0);
      
      const facilityEndOfDay = new Date();
      facilityEndOfDay.setFullYear(year, month - 1, day); // month is 0-indexed  
      facilityEndOfDay.setHours(23, 59, 59, 999);
      
      // Convert from facility timezone to UTC for storage
      localStartDate = fromZonedTime(facilityStartOfDay, facilityTimezone);
      localEndDate = fromZonedTime(facilityEndOfDay, facilityTimezone);
      
      // Add a special flag to the type field to ensure it's recognized as all-day
      // Ensure alertType has a valid value to prevent "all-day:undefined"
      const validAlertType = alertType && alertType !== 'undefined' && alertType.trim() !== '' ? alertType : 'maintenance';
      finalAlertType = `all-day:${validAlertType}`;
      
      console.log(`Creating all-day alert for date: ${date} in facility timezone: ${facilityTimezone}`);
      console.log(`Original alertType: "${alertType}", Valid alertType: "${validAlertType}"`);
      console.log(`Facility times - Start: ${facilityStartOfDay.toISOString()}, End: ${facilityEndOfDay.toISOString()}`);
      console.log(`UTC times - Start: ${localStartDate.toISOString()}, End: ${localEndDate.toISOString()}`);
      console.log(`Modified type with flag: ${finalAlertType}, Severity: ${severity}`);
    } else {
      // Regular time-bound event
      // Convert times to date objects using our utility function
      const startDate = timeToDate(date, startTime);
      const endDate = timeToDate(date, endTime);
      
      // Debugging the timezone issue
      console.log(`Creating time-bound alert for date: ${date}, converted start: ${startDate.toISOString()}`);
      
      // Ensure we preserve the intended day regardless of timezone
      localStartDate = startDate;
      localEndDate = endDate;
    }
    
    // When using "Add Alert" button with alertsOnly=true, respect all settings chosen by the user
    const effectiveSeverity = severity; // Use the severity chosen by the user
    
    // Only add the all-day prefix if the user selected isAllDay
    // This makes the "All Day" checkbox actually work as intended
    // Ensure alertType has a valid value to prevent "all-day:undefined"
    const validAlertTypeForEffective = alertType && alertType !== 'undefined' && alertType.trim() !== '' ? alertType : 'maintenance';
    const effectiveType = isAllDay && !finalAlertType.startsWith("all-day:") 
      ? `all-day:${validAlertTypeForEffective}` 
      : finalAlertType || validAlertTypeForEffective;

    console.log(`Creating alert with type: ${effectiveType}, severity: ${effectiveSeverity}, alertsOnly: ${alertsOnly}`);
    
    const alertData: Partial<InsertAlert> = {
      title,
      description,
      alertType: effectiveType, // Use the effective type with proper flag
      start: localStartDate instanceof Date 
        ? localStartDate 
        : new Date(localStartDate), // Convert to Date if it's a string
      end: localEndDate instanceof Date 
        ? localEndDate 
        : new Date(localEndDate), // Convert to Date if it's a string
      notifyList: notifyList,
      severity: effectiveSeverity // Use the effective severity
    };
    
    if (alert && alert.id) {
      // Extract numeric ID from alert.id (handles both "alert-1" and 1 formats)
      const numericId = typeof alert.id === 'string' && alert.id.startsWith('alert-')
        ? parseInt(alert.id.replace('alert-', ''))
        : typeof alert.id === 'string' 
          ? parseInt(alert.id)
          : alert.id;
      
      console.log("Updating alert - Original ID:", alert.id, "Extracted numeric ID:", numericId, "Data:", alertData);
      
      try {
        await updateAlert.mutateAsync({ id: numericId, data: alertData });
        showNotification({
          type: "success",
          title: "Alert Updated",
          message: "The facility alert has been successfully updated.",
        });
      } catch (error) {
        console.error("Error updating alert:", error);
        console.error("Error details:", {
          name: error?.name,
          message: error?.message,
          response: error?.response,
          status: error?.response?.status
        });
        
        let errorMessage = "Failed to update the alert. Please try again.";
        
        // Try to extract more specific error message
        if (error?.response?.status === 400) {
          errorMessage = "Invalid alert data format.";
        } else if (error?.response?.status === 403) {
          errorMessage = "You don't have permission to update this alert.";
        } else if (error?.response?.status === 404) {
          errorMessage = "Alert not found.";
        } else if (error?.message) {
          errorMessage = `Update failed: ${error.message}`;
        }
        
        showNotification({
          type: "error",
          title: "Update Failed",
          message: errorMessage,
        });
        return;
      }
    } else {
      // Create new alert(s) - handle multiple dates
      const datesToCreate = selectedDates.length > 0 ? selectedDates : [new Date(date)];
      
      console.log(`Creating ${datesToCreate.length} alert(s) for selected dates`);
      
      const alertItems: Partial<InsertAlert>[] = [];
      
      for (const selectedDateItem of datesToCreate) {
        const facilityTimezone = getFacilityTimezone();
        const dateFormatter = new Intl.DateTimeFormat('en-CA', { 
          timeZone: facilityTimezone,
          year: 'numeric',
          month: '2-digit', 
          day: '2-digit'
        });
        const dateStr = dateFormatter.format(selectedDateItem);
        
        let alertStart, alertEnd;
        let perDateAlertType = alertType;
        
        if (isAllDay) {
          const [year, month, day] = dateStr.split('-').map(Number);
          const facilityStartOfDay = new Date();
          facilityStartOfDay.setFullYear(year, month - 1, day);
          facilityStartOfDay.setHours(0, 0, 0, 0);
          
          const facilityEndOfDay = new Date();
          facilityEndOfDay.setFullYear(year, month - 1, day);
          facilityEndOfDay.setHours(23, 59, 59, 999);
          
          alertStart = fromZonedTime(facilityStartOfDay, facilityTimezone);
          alertEnd = fromZonedTime(facilityEndOfDay, facilityTimezone);
          
          const validType = alertType && alertType !== 'undefined' && alertType.trim() !== '' ? alertType : 'maintenance';
          perDateAlertType = `all-day:${validType}`;
        } else {
          alertStart = timeToDate(dateStr, startTime);
          alertEnd = timeToDate(dateStr, endTime);
          perDateAlertType = alertType && alertType !== 'undefined' && alertType.trim() !== '' ? alertType : 'maintenance';
        }
        
        alertItems.push({
          title,
          description,
          alertType: perDateAlertType,
          start: alertStart,
          end: alertEnd,
          notifyList: notifyList,
          severity: severity
        });
      }
      
      try {
        if (alertItems.length === 1) {
          // Single date - use regular endpoint
          await createAlert.mutateAsync(alertItems[0] as InsertAlert);
        } else {
          // Multiple dates - use bulk endpoint (sends ONE email with all dates)
          await createBulkAlerts.mutateAsync(alertItems as InsertAlert[]);
        }
        
        showNotification({
          type: "success",
          title: alertItems.length > 1 ? "Alerts Created" : "Alert Created",
          message: alertItems.length > 1 
            ? `Successfully created ${alertItems.length} facility alerts. One notification email was sent with all dates listed.`
            : "The facility alert has been successfully created.",
        });
      } catch (error) {
        console.error(`Error creating alert(s):`, error);
        showNotification({
          type: "error",
          title: "Alert Creation Failed",
          message: `Failed to create alert(s). Please try again.`,
        });
        return;
      }
    }
    
    onClose();
  };
  
  // Handle alert deletion
  const handleDelete = async () => {
    if (alert && alert.id) {
      // Extract numeric ID from alert.id (handles both "alert-1" and 1 formats)
      const numericId = typeof alert.id === 'string' && alert.id.startsWith('alert-')
        ? parseInt(alert.id.replace('alert-', ''))
        : typeof alert.id === 'string' 
          ? parseInt(alert.id)
          : alert.id;
      
      console.log("Deleting alert - Original ID:", alert.id, "Extracted numeric ID:", numericId);
      
      try {
        await deleteAlert.mutateAsync(numericId);
        
        showNotification({
          type: "success",
          title: "Alert Deleted",
          message: "The facility alert has been successfully deleted.",
        });
        
        onClose();
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("Error deleting alert:", error);
        showNotification({
          type: "error",
          title: "Delete Failed",
          message: "Failed to delete the alert. Please try again.",
        });
      }
    } else {
      console.error("Cannot delete alert: Invalid alert ID");
      showNotification({
        type: "error",
        title: "Delete Failed",
        message: "Cannot delete alert: Invalid alert ID.",
      });
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
            {alert ? "Edit Alert" : "New Facility Alert"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter alert title"
              required
            />
          </div>
          
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
          
          <div className="space-y-3">
            {/* Date Selection - Single date for edit, multi-date for create */}
            {alert ? (
              <div className="grid grid-cols-3 gap-4">
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
                
                <div className={isAllDay ? "opacity-50" : ""}>
                  <Label htmlFor="start-time">Start Time</Label>
                  <Select 
                    value={startTime} 
                    onValueChange={setStartTime} 
                    required
                    disabled={isAllDay}
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
                
                <div className={isAllDay ? "opacity-50" : ""}>
                  <Label htmlFor="end-time">End Time</Label>
                  <Select 
                    value={endTime} 
                    onValueChange={setEndTime} 
                    required
                    disabled={isAllDay}
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
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>Dates (select one or more)</Label>
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          selectedDates.length === 0 && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDates.length === 0
                          ? "Select dates"
                          : selectedDates.length === 1
                          ? format(selectedDates[0], "MMM d, yyyy")
                          : `${selectedDates.length} dates selected`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="multiple"
                        selected={selectedDates}
                        onSelect={(dates) => {
                          setSelectedDates(dates || []);
                          if (dates && dates.length > 0) {
                            const facilityTimezone = getFacilityTimezone();
                            const dateFormatter = new Intl.DateTimeFormat('en-CA', { 
                              timeZone: facilityTimezone,
                              year: 'numeric',
                              month: '2-digit', 
                              day: '2-digit'
                            });
                            setDate(dateFormatter.format(dates[0]));
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  
                  {selectedDates.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {[...selectedDates]
                        .sort((a, b) => a.getTime() - b.getTime())
                        .map((d, idx) => (
                          <Badge 
                            key={idx} 
                            variant="secondary"
                            className="flex items-center gap-1 px-2 py-1"
                          >
                            {format(d, "MMM d")}
                            <button
                              type="button"
                              onClick={() => {
                                const newDates = selectedDates.filter((_, i) => i !== idx);
                                setSelectedDates(newDates);
                                if (newDates.length > 0) {
                                  const facilityTimezone = getFacilityTimezone();
                                  const dateFormatter = new Intl.DateTimeFormat('en-CA', { 
                                    timeZone: facilityTimezone,
                                    year: 'numeric',
                                    month: '2-digit', 
                                    day: '2-digit'
                                  });
                                  setDate(dateFormatter.format(newDates[0]));
                                }
                              }}
                              className="hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className={isAllDay ? "opacity-50" : ""}>
                    <Label htmlFor="start-time">Start Time</Label>
                    <Select 
                      value={startTime} 
                      onValueChange={setStartTime} 
                      required
                      disabled={isAllDay}
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
                  
                  <div className={isAllDay ? "opacity-50" : ""}>
                    <Label htmlFor="end-time">End Time</Label>
                    <Select 
                      value={endTime} 
                      onValueChange={setEndTime} 
                      required
                      disabled={isAllDay}
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
            )}
            
            <div className="flex items-center space-x-2 ml-1">
              <Checkbox
                id="all-day"
                checked={isAllDay}
                onCheckedChange={(checked) => setIsAllDay(checked === true)}
              />
              <label
                htmlFor="all-day"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                All Day Alert
              </label>
            </div>
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide details about this facility-wide alert"
              rows={3}
            />
          </div>
          

          
          <DialogFooter className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {alert && (
                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button 
                      type="button" 
                      variant="destructive" 
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <Trash2 size={16} />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Alert</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this alert? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDelete}
                        disabled={deleteAlert.isPending}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        {deleteAlert.isPending ? (
                          <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Deleting...
                          </span>
                        ) : "Delete Alert"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createAlert.isPending || updateAlert.isPending}>
                {createAlert.isPending || updateAlert.isPending ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : alert ? "Update Alert" : "Create Alert"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}