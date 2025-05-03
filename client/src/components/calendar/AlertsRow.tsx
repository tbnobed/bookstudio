import { useState } from "react";
import { cn } from "@/lib/utils";
import { Booking } from "@shared/schema";
import { formatTime, isWeekend, isSameDay } from "@/lib/dateUtils";
import AlertModal from "../alerts/AlertModal";
import { useAuthContext } from "@/contexts/AuthContext";

interface AlertsRowProps {
  weekDates: Date[];
  alerts: Booking[];
  onAlertClick: (booking: Booking) => void;
}

export default function AlertsRow({ weekDates, alerts, onAlertClick }: AlertsRowProps) {
  const { user } = useAuthContext();
  const [isNewAlertModalOpen, setIsNewAlertModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editAlert, setEditAlert] = useState<Booking | null>(null);
  const [isEditAlertModalOpen, setIsEditAlertModalOpen] = useState(false);
  
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
  const handleAlertEditClick = (alert: Booking) => {
    setEditAlert(alert);
    setIsEditAlertModalOpen(true);
  };

  return (
    <>
      <div className="h-14 border-b bg-gray-100 flex items-center justify-center sticky left-0 top-0 z-10">
        <span className="text-xs font-bold uppercase text-gray-700">Facility Alerts</span>
      </div>
      {weekDates.map((date, index) => {
        // Filter alerts for this date (maintenance and IT support)
        const dayAlerts = alerts.filter(alert => 
          isSameDay(new Date(alert.start), date) && 
          (alert.type === "maintenance" || alert.type === "it_support")
        );
        
        return (
          <div 
            key={index} 
            className={cn(
              "relative h-14 border-b border-r",
              isWeekend(date) ? "bg-gray-50" : "bg-white",
              "cursor-pointer hover:bg-gray-100"
            )}
            onClick={() => handleCellClick(date)}
          >
            {dayAlerts.length > 0 ? (
              <div className="flex flex-col h-full w-full p-1 overflow-hidden">
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
                        "border rounded-md p-1 mb-1 overflow-hidden text-overflow-ellipsis whitespace-nowrap text-xs",
                        colorClass
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAlertEditClick(alert);
                      }}
                    >
                      <div className="font-medium truncate flex items-center">
                        <span className={`w-2 h-2 rounded-full mr-1 ${
                          alert.severity === "critical" ? "bg-red-500" : 
                          alert.severity === "high" ? "bg-orange-500" :
                          alert.severity === "medium" ? "bg-amber-500" : "bg-blue-500"
                        }`}></span>
                        {alert.title}
                      </div>
                      <div className="text-xs truncate pl-3">
                        {formatTime(new Date(alert.start))} - {formatTime(new Date(alert.end))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full">
                <span className="text-xs text-gray-400">No alerts</span>
                {canCreateAlerts && (
                  <span className="text-xs text-blue-500 hover:text-blue-700 cursor-pointer mt-0.5">
                    + Add facility alert
                  </span>
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