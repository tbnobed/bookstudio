import { useState } from "react";
import { cn } from "@/lib/utils";
import { Booking } from "@shared/schema";
import { formatTime, isWeekend, isSameDay } from "@/lib/dateUtils";
import AlertModal from "../alerts/AlertModal";
import { useAuthContext } from "@/contexts/AuthContext";

// Define an interface to match the API response format with snake_case
interface ApiBooking extends Omit<Booking, 'studioId' | 'userId' | 'templateId' | 'createdAt' | 'notifyList'> {
  studio_id: number | null;
  user_id: number;
  template_id: number | null;
  created_at: string | Date | null;
  notify_list: any;
}

interface AlertsRowProps {
  weekDates: Date[];
  alerts: ApiBooking[]; // Now using our custom API type
  onAlertClick: (booking: ApiBooking) => void;
}

export default function AlertsRow({ weekDates, alerts, onAlertClick }: AlertsRowProps) {
  const { user } = useAuthContext();
  const [isNewAlertModalOpen, setIsNewAlertModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editAlert, setEditAlert] = useState<ApiBooking | null>(null);
  const [isEditAlertModalOpen, setIsEditAlertModalOpen] = useState(false);
  
  // Debug the alerts collection
  console.log("All alerts in AlertsRow: ", JSON.stringify(alerts));
  
  // Check if user has permission to create alerts (only engineers and admins)
  const canCreateAlerts = user?.role === "engineer" || user?.role === "admin" || user?.role === "it";

  // Handle cell click to create a new alert
  const handleCellClick = (date: Date) => {
    // Only allow alert creation for users with permissions
    if (canCreateAlerts) {
      setSelectedDate(date);
      setIsNewAlertModalOpen(true);
    }
  };
  
  // Handle alert click for editing
  const handleAlertEditClick = (alert: ApiBooking) => {
    setEditAlert(alert);
    setIsEditAlertModalOpen(true);
  };

  return (
    <>
      <div className="h-20 border-b bg-gray-100 flex items-center justify-center sticky left-0 top-0 z-10">
        <span className="text-xs font-bold uppercase text-gray-700">Facility Alerts</span>
      </div>
      {weekDates.map((date, index) => {
        // Filter alerts for this date (maintenance and IT support)
        // Only include facility-wide alerts (with null studioId) in this row
        const dayAlerts = alerts.filter(alert => {
          const alertStart = new Date(alert.start);
          console.log(`Alert #${alert.id} - ${alert.title}: ${alertStart.toISOString()}`);
          
          // Cast the alert to our API interface type which includes snake_case properties
          const apiAlert = alert as unknown as ApiBooking;
          
          // Check for facility-wide alerts (null studioId)
          const isFacilityWideAlert = apiAlert.studio_id === null;
          
          // Debug the matching process
          console.log(`Alert ${alert.id} - Studio ID: ${apiAlert.studio_id}, Is facility-wide: ${isFacilityWideAlert}`);
          console.log(`Comparing alert day: ${alertStart.getFullYear()}-${alertStart.getMonth()}-${alertStart.getDate()} to day cell: ${date.getFullYear()}-${date.getMonth()}-${date.getDate()} - Same day: ${isSameDay(alertStart, date)}`);
          
          return isSameDay(alertStart, date) && 
            (alert.type === "maintenance" || alert.type === "it_support") &&
            isFacilityWideAlert;
        });
        
        console.log(`Day cell ${date.toDateString()} has ${dayAlerts.length} alerts`);
        
        return (
          <div 
            key={index} 
            className={cn(
              "relative h-20 border-b border-r",
              isWeekend(date) ? "bg-gray-50" : "bg-white",
              "cursor-pointer hover:bg-gray-100"
            )}
            onClick={() => handleCellClick(date)}
          >
            {dayAlerts.length > 0 ? (
              <div className="flex flex-col h-full w-full p-1 overflow-y-auto">
                {dayAlerts.map((alert) => {
                  // Determine color based on alert severity
                  let colorClass = "bg-blue-100 border-blue-400 border text-blue-800 shadow-sm"; // default - low severity
                  
                  if (alert.severity === "critical") {
                    colorClass = "bg-red-100 border-red-500 border text-red-800 shadow-sm";
                  } else if (alert.severity === "high") {
                    colorClass = "bg-orange-100 border-orange-400 border text-orange-800 shadow-sm";
                  } else if (alert.severity === "medium") {
                    colorClass = "bg-amber-100 border-amber-400 border text-amber-800 shadow-sm";
                  }
                  
                  return (
                    <div 
                      key={alert.id}
                      className={cn(
                        "relative group border rounded-md px-2 py-1 mb-1 overflow-visible text-xs",
                        colorClass,
                        "transition-all hover:shadow-md cursor-pointer"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAlertEditClick(alert);
                      }}
                      title={`${alert.title}
Type: ${alert.type === "maintenance" ? "Maintenance" : "IT Support"}
Severity: ${alert.severity}
Time: ${formatTime(new Date(alert.start))} - ${formatTime(new Date(alert.end))}
${alert.description ? `Description: ${alert.description}` : ''}
(Click to edit)`}
                    >
                      <div className="flex items-center w-full">
                        <span className={`w-2 h-2 rounded-full mr-1 flex-shrink-0 ${
                          alert.severity === "critical" ? "bg-red-500" : 
                          alert.severity === "high" ? "bg-orange-500" :
                          alert.severity === "medium" ? "bg-amber-500" : "bg-blue-500"
                        }`}></span>
                        <span className="font-medium inline-block w-full overflow-hidden text-ellipsis">{alert.title}</span>
                      </div>
                      <div className="text-xs pl-3">
                        {formatTime(new Date(alert.start))} - {formatTime(new Date(alert.end))}
                      </div>
                    </div>
                  );
                })}
                
                {/* Even when there are alerts, still show the + Add button */}
                {canCreateAlerts && (
                  <div 
                    className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer mt-1.5 text-center bg-blue-50 hover:bg-blue-100 py-0.5 px-1 rounded border border-blue-200 shadow-sm flex items-center justify-center gap-1 transition-all hover:shadow"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCellClick(date);
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="font-medium">Add alert</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full">
                <span className="text-xs text-gray-400 mb-1">No alerts</span>
                {canCreateAlerts && (
                  <div 
                    className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer text-center bg-blue-50 hover:bg-blue-100 py-0.5 px-2 rounded border border-blue-200 shadow-sm flex items-center justify-center gap-1 transition-all hover:shadow"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent parent click handler
                      handleCellClick(date);
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="font-medium">Add facility alert</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* New Alert Modal */}
      {selectedDate && (
        <AlertModal 
          isOpen={isNewAlertModalOpen}
          onClose={() => setIsNewAlertModalOpen(false)}
          selectedDate={selectedDate}
        />
      )}
      
      {/* Edit Alert Modal */}
      {editAlert && (
        <AlertModal
          isOpen={isEditAlertModalOpen}
          onClose={() => setIsEditAlertModalOpen(false)}
          alert={editAlert}
        />
      )}
    </>
  );
}