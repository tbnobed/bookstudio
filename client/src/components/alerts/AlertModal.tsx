import { useState, useEffect } from "react";
import { useStudioBookings } from "@/hooks/useStudioBookings";
import { InsertBooking } from "@shared/schema";
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
import { Trash2 } from "lucide-react";
import { generateTimeOptions, timeToDate } from "@/lib/dateUtils";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert?: any; // Optional existing alert for editing
  selectedDate?: Date;
}

export default function AlertModal({ 
  isOpen, 
  onClose, 
  alert, 
  selectedDate 
}: AlertModalProps) {
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [alertType, setAlertType] = useState("maintenance");
  const [severity, setSeverity] = useState("medium");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("9:00am");
  const [endTime, setEndTime] = useState("10:00am");
  const [notifyList, setNotifyList] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Booking mutation
  const { createBooking, updateBooking, deleteBooking } = useStudioBookings();

  // Set initial form values
  useEffect(() => {
    if (isOpen) {
      if (alert) {
        // Edit mode - populate form with alert data
        setTitle(alert.title);
        setDescription(alert.description || "");
        setAlertType(alert.type);
        setSeverity(alert.severity || "medium");
        
        const alertDate = new Date(alert.start);
        setDate(alertDate.toISOString().split("T")[0]);
        
        // Parse times
        const startHours = new Date(alert.start).getHours();
        const startMinutes = new Date(alert.start).getMinutes();
        const startPeriod = startHours >= 12 ? "pm" : "am";
        const formattedStartHours = startHours > 12 ? startHours - 12 : (startHours === 0 ? 12 : startHours);
        setStartTime(`${formattedStartHours}:${startMinutes.toString().padStart(2, "0")}${startPeriod}`);
        
        const endHours = new Date(alert.end).getHours();
        const endMinutes = new Date(alert.end).getMinutes();
        const endPeriod = endHours >= 12 ? "pm" : "am";
        const formattedEndHours = endHours > 12 ? endHours - 12 : (endHours === 0 ? 12 : endHours);
        setEndTime(`${formattedEndHours}:${endMinutes.toString().padStart(2, "0")}${endPeriod}`);
        
        setNotifyList(alert.notifyList || []);
      } else {
        // Create mode - set defaults
        resetForm();
        
        // Set selected date if provided
        if (selectedDate) {
          setDate(selectedDate.toISOString().split("T")[0]);
        }
      }
    }
  }, [isOpen, alert, selectedDate]);

  // Reset form to defaults
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setAlertType("maintenance");
    setSeverity("medium");
    setDate(selectedDate ? selectedDate.toISOString().split("T")[0] : "");
    setStartTime("9:00am");
    setEndTime("10:00am");
    setNotifyList([]);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert times to date objects using our utility function
    // Create dates with timezone handling to prevent day shift
    const startDate = timeToDate(date, startTime);
    const endDate = timeToDate(date, endTime);
    
    // Debugging the timezone issue
    console.log(`Creating alert for date: ${date}, converted start: ${startDate.toISOString()}`);
    
    // Ensure we preserve the intended day regardless of timezone
    const localStartDate = new Date(startDate);
    const localEndDate = new Date(endDate);
    
    const alertData: Partial<InsertBooking> = {
      title,
      description,
      studioId: null, // Facility-wide alert - no specific studio
      type: alertType,
      start: localStartDate.toISOString(),
      end: localEndDate.toISOString(),
      notifyList: notifyList,
      severity: severity
    };
    
    if (alert) {
      // Update existing alert
      await updateBooking.mutateAsync({ id: alert.id, data: alertData });
    } else {
      // Create new alert
      console.log("Creating alert with data:", alertData);
      try {
        const result = await createBooking.mutateAsync(alertData as InsertBooking);
        console.log("Alert creation result:", result);
      } catch (error) {
        console.error("Error creating alert:", error);
      }
    }
    
    onClose();
  };
  
  // Handle alert deletion
  const handleDelete = async () => {
    if (alert) {
      try {
        await deleteBooking.mutateAsync(alert.id);
        onClose();
      } catch (error) {
        console.error("Error deleting alert:", error);
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
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Alert Type</Label>
              <Select value={alertType} onValueChange={setAlertType} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="it_support">IT Support</SelectItem>
                </SelectContent>
              </Select>
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
          </div>
          
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
              placeholder="Provide details about this facility-wide alert"
              rows={3}
            />
          </div>
          
          <div>
            <Label>Notify Crew</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {["Camera Operators", "Sound Engineers", "Lighting Technicians", "Production Assistants", "Directors"].map((crew) => (
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
                        disabled={deleteBooking.isPending}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        {deleteBooking.isPending ? (
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
              <Button type="submit" disabled={createBooking.isPending || updateBooking.isPending}>
                {createBooking.isPending || updateBooking.isPending ? (
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