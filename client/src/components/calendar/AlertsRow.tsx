import { AlertTriangle, AlertCircle, Activity, Bell } from "lucide-react";
import { getFacilityTimezone } from "../../lib/timezoneConfig";
import { Booking } from "@shared/schema";

interface ApiBooking extends Omit<Booking, 'studioId' | 'userId' | 'templateId' | 'createdAt' | 'notifyList'> {
  studio_id: number | null;
  user_id: number;
  template_id: number | null;
  created_at: string | Date | null;
  notify_list: any;
}

// Define alert object that can be either a booking-type alert or a proper alert
interface AlertObject {
  id: number | string;
  title: string;
  description: string;
  start: string;
  end: string;
  type?: string;
  alertType?: string;
  severity?: string;
  status?: string;
}

interface AlertsRowProps {
  weekDates: Date[];
  alerts?: ApiBooking[]; // Legacy alerts from bookings
  onAlertClick: (booking: ApiBooking) => void;
  readOnly?: boolean;
}

function isAllDayAlert(alert: ApiBooking): boolean {
  if (alert.type?.startsWith('all-day:')) return true;
  if (alert.start && alert.end) {
    const start = new Date(alert.start);
    const end = new Date(alert.end);
    const duration = end.getTime() - start.getTime();
    return duration >= 23 * 60 * 60 * 1000; // 23+ hours
  }
  return false;
}

export default function AlertsRow({ weekDates, alerts = [], onAlertClick, readOnly = false }: AlertsRowProps) {
  // Combine legacy alerts with API alerts to create a unified alerts array
  const apiAlerts = alerts;
  
  console.log("AlertsRow - API alerts received:", apiAlerts.length);

  const handleCellClick = (date: Date) => {
    if (readOnly) return;
    
    // Create a new alert for this date
    const alertBooking: ApiBooking = {
      id: 0,
      title: "",
      description: "",
      start: date.toISOString(),
      end: date.toISOString(),
      studio_id: null,
      user_id: 1,
      type: "maintenance",
      status: "active",
      severity: "medium",
      template_id: null,
      notify_list: [],
      created_at: new Date().toISOString(),
    };
    
    onAlertClick(alertBooking);
  };

  const handleAlertEditClick = (alert: ApiBooking) => {
    onAlertClick(alert);
  };

  return (
    <>
      {/* Time column header for Alerts */}
      <div className="w-40 h-10 border-b border-r border-gray-200 bg-orange-50 flex items-center justify-center">
        <div className="text-xs font-semibold text-orange-700">ALERTS</div>
      </div>
      
      {/* Alert cells for each day */}
      {weekDates.map((date, index) => {
          // Filter alerts to only show those that span this date
          const dayAlerts = apiAlerts.filter((alert) => {
            const alertStart = new Date(alert.start);
            const alertEnd = new Date(alert.end);
            
            // Check if alert spans this date using facility timezone
            const facilityTimezone = getFacilityTimezone();
            
            // Use consistent date parsing approach to avoid timezone conversion issues
            const dateFormatter = new Intl.DateTimeFormat('en-CA', { 
              timeZone: facilityTimezone,
              year: 'numeric',
              month: '2-digit', 
              day: '2-digit'
            });
            
            // Get the date we're checking in YYYY-MM-DD format in facility timezone
            const checkingDateStr = dateFormatter.format(date);
            
            // Get the alert start date in YYYY-MM-DD format in facility timezone  
            const alertStartDateStr = dateFormatter.format(alertStart);
            
            // For all-day alerts, check if the alert date matches the day we're checking
            const isAllDayAlert = (alert as any).alertType?.startsWith('all-day:') || 
                                  (alert as any).type?.startsWith('all-day:');
            
            let overlapsWithDay;
            if (isAllDayAlert) {
              // All-day alerts should only appear on their specific date
              overlapsWithDay = alertStartDateStr === checkingDateStr;
              
              // Debug all-day alert filtering
              console.log(`*** ALL-DAY ALERT FILTERING DEBUG ***`);
              console.log(`Alert #${alert.id} - ${alert.title}`);
              console.log(`Checking date: ${checkingDateStr}`);
              console.log(`Alert start date: ${alertStartDateStr}`);
              console.log(`Overlap result: ${overlapsWithDay}`);
            } else {
              // Regular time-based alerts use simple date overlap logic
              const dateStart = new Date(date);
              dateStart.setHours(0, 0, 0, 0);
              const dateEnd = new Date(date);
              dateEnd.setHours(23, 59, 59, 999);
              overlapsWithDay = (alertStart <= dateEnd) && (alertEnd >= dateStart);
            }
            
            return overlapsWithDay;
          });
          
          console.log(`Day cell ${date.toDateString()} has ${dayAlerts.length} alerts`);

          return (
            <div
              key={index}
              className="h-10 border-b border-r border-gray-200 relative cursor-pointer hover:bg-gray-50"
              onClick={() => handleCellClick(date)}
            >
              {dayAlerts.map((alert) => {
                const getSeverityColor = (severity?: string) => {
                  switch (severity) {
                    case 'low': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
                    case 'medium': return 'bg-orange-100 border-orange-300 text-orange-800';
                    case 'high': return 'bg-red-100 border-red-300 text-red-800';
                    case 'critical': return 'bg-purple-100 border-purple-300 text-purple-800';
                    default: return 'bg-yellow-100 border-yellow-300 text-yellow-800';
                  }
                };

                const getSeverityIcon = (severity?: string) => {
                  switch (severity) {
                    case 'low': return <Activity className="w-3 h-3" />;
                    case 'medium': return <AlertCircle className="w-3 h-3" />;
                    case 'high': return <AlertTriangle className="w-3 h-3" />;
                    case 'critical': return <Bell className="w-3 h-3" />;
                    default: return <AlertCircle className="w-3 h-3" />;
                  }
                };

                return (
                  <div
                    key={alert.id}
                    className={`absolute top-1 left-1 right-1 p-1 rounded border text-xs truncate cursor-pointer hover:z-10 ${getSeverityColor(alert.severity)}`}
                    style={{ fontSize: '10px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAlertEditClick(alert);
                    }}
                    title={`${alert.title} - ${alert.description} (${alert.severity})`}
                  >
                    <div className="flex items-center gap-1">
                      {getSeverityIcon(alert.severity)}
                      <span className="truncate">{alert.title}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
    </>
  );
}