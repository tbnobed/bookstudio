import { useState } from "react";
import { cn } from "@/lib/utils";
import { Booking } from "@shared/schema";
import { formatTime, isWeekend, isSameDay } from "@/lib/dateUtils";
import BookingModal from "../booking/BookingModal";

interface AlertsRowProps {
  weekDates: Date[];
  alerts: Booking[];
  onAlertClick: (booking: Booking) => void;
}

export default function AlertsRow({ weekDates, alerts, onAlertClick }: AlertsRowProps) {
  const [isNewAlertModalOpen, setIsNewAlertModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Handle cell click to create a new alert
  const handleCellClick = (date: Date) => {
    setSelectedDate(date);
    setIsNewAlertModalOpen(true);
  };

  return (
    <>
      <div className="h-16 border-b bg-gray-100 flex items-center justify-center">
        <span className="text-xs font-bold uppercase text-gray-700">Outages & Alerts</span>
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
              "relative h-16 border-b border-r",
              isWeekend(date) ? "bg-gray-50" : "bg-white",
              "cursor-pointer hover:bg-gray-100"
            )}
            onClick={() => handleCellClick(date)}
          >
            {dayAlerts.length > 0 ? (
              <div className="flex flex-col h-full w-full p-1 overflow-hidden">
                {dayAlerts.map((alert) => {
                  // Determine color based on alert type
                  const colorClass = alert.type === "maintenance" 
                    ? "bg-amber-100 border-amber-300 text-amber-800"
                    : "bg-red-500 border-red-600 text-white";
                  
                  return (
                    <div 
                      key={alert.id}
                      className={cn(
                        "border rounded-md p-1 mb-1 overflow-hidden text-overflow-ellipsis whitespace-nowrap text-xs",
                        colorClass
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAlertClick(alert);
                      }}
                    >
                      <div className="font-medium truncate">{alert.title}</div>
                      <div className="text-xs truncate">
                        {formatTime(new Date(alert.start))} - {formatTime(new Date(alert.end))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-gray-400">
                No alerts
              </div>
            )}
          </div>
        );
      })}

      {/* New Alert Modal */}
      {selectedDate && (
        <BookingModal 
          isOpen={isNewAlertModalOpen}
          onClose={() => setIsNewAlertModalOpen(false)}
          selectedDate={selectedDate}
          alertsOnly={true}
        />
      )}
    </>
  );
}