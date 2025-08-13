import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO, endOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ChevronLeft, ChevronRight, Settings, Calendar, AlertTriangle, Camera, Monitor, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWeatherForecast } from "@/hooks/useWeatherForecast";
import WeatherForecastCell from "@/components/calendar/WeatherForecastCell";
import { Header } from "@/components/layout/Header";
import { getFacilityTimezone_Dynamic } from "@/lib/dateUtils";

interface BookingData {
  id: number;
  title: string;
  description: string | null;
  start: string;
  end: string;
  status: string;
  type: string;
  severity?: string;
  color?: string;
  pcrRoomId?: number;
}

interface TimelineCalendarProps {
  currentDate?: Date;
  selectedStudioIds?: number[];
}

export default function TimelineCalendar({ currentDate, selectedStudioIds = [] }: TimelineCalendarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [weekStart, setWeekStart] = useState(() => {
    const validDate = currentDate || new Date();
    return startOfWeek(validDate, { weekStartsOn: 0 });
  });

  // Fetch weather forecast
  const { forecast } = useWeatherForecast();

  // Generate week days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      return {
        date,
        dayName: format(date, 'EEE'),
        dayNumber: format(date, 'd'),
        fullDate: format(date, 'yyyy-MM-dd')
      };
    });
  }, [weekStart]);

  // Fetch studios
  const { data: studios = [] } = useQuery({
    queryKey: ['/api/studios'],
  });

  // Fetch bookings for the week
  const startDate = weekStart;
  const endDate = endOfDay(addDays(weekStart, 6));
  
  const { data: bookings = [] } = useQuery({
    queryKey: ['/api/bookings', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!startDate || !endDate) return [];
      const params = new URLSearchParams({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });
      const response = await fetch(`/api/bookings?${params}`);
      return response.json();
    },
    enabled: !!startDate && !!endDate
  });

  // Fetch alerts for the week
  const { data: alertBookings = [] } = useQuery({
    queryKey: ['/api/alerts'],
  });

  // Navigation handlers
  const goToPreviousWeek = () => {
    const newWeekStart = subWeeks(weekStart, 1);
    setWeekStart(newWeekStart);
  };

  const goToNextWeek = () => {
    const newWeekStart = addWeeks(weekStart, 1);
    setWeekStart(newWeekStart);
  };

  const goToToday = () => {
    const today = new Date();
    const todayWeekStart = startOfWeek(today, { weekStartsOn: 0 });
    setWeekStart(todayWeekStart);
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-100 via-white to-blue-50">

      {/* Top Navigation */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden"
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={goToNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900">
            {format(weekStart, 'MMMM yyyy')}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            Timeline View
          </span>
        </div>
      </div>

      {/* Alerts Row */}
      {alertBookings.length > 0 && (
        <div className="bg-orange-50 border-b border-orange-200">
          <div className="flex">
            <div className="w-16 border-r border-orange-200 bg-orange-100 flex items-center justify-center p-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
            </div>
            
            {weekDays.map((day) => {
              const dayAlerts = alertBookings.filter(alert => {
                const alertDate = toZonedTime(parseISO(alert.start), getFacilityTimezone_Dynamic());
                return isSameDay(alertDate, day.date);
              });

              return (
                <div
                  key={day.fullDate}
                  className="flex-1 min-w-[140px] border-r border-orange-200 min-h-[80px] relative"
                >
                  {dayAlerts.length > 0 ? (
                    <div className="p-2 space-y-1">
                      {dayAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className="p-2 rounded text-xs cursor-pointer transition-all duration-200 hover:shadow-sm border bg-orange-100 border-orange-300 text-orange-800"
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span className="font-medium truncate text-xs">{alert.title}</span>
                          </div>
                          {alert.severity && (
                            <div className="text-xs font-bold mt-1 px-1 py-0.5 rounded bg-black bg-opacity-20">
                              {alert.severity.toUpperCase()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2 text-xs text-orange-400 italic text-center">No alerts</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Calendar Grid - SCROLLABLE */}
      <div className="flex-1 overflow-hidden min-h-0">
        <div className="h-full overflow-y-auto overflow-x-auto">
          <div className="min-w-[1000px]">
            {/* Day Headers */}
            <div className="sticky top-0 bg-white border-b border-gray-200 z-40 shadow-sm">
              <div className="flex">
                <div className="w-16 border-r border-gray-200 bg-gray-50"></div>
                
                {weekDays.map((day) => {
                  const today = toZonedTime(new Date(), getFacilityTimezone_Dynamic());
                  const isToday = isSameDay(day.date, today);
                  
                  return (
                    <div
                      key={day.fullDate}
                      className={`flex-1 min-w-[140px] border-r border-gray-200 relative ${
                        isToday ? 'bg-blue-50' : 'bg-white'
                      }`}
                    >
                      <div className="p-3 text-center">
                        <div className="text-xs font-medium text-gray-500 mb-1">
                          {day.dayName}
                        </div>
                        <div className={`text-lg font-semibold ${
                          isToday ? 'text-blue-600' : 'text-gray-900'
                        }`}>
                          {day.dayNumber}
                        </div>
                        
                        <div className="mt-2">
                          <WeatherForecastCell 
                            date={day.date} 
                            forecast={forecast?.forecast.find(f => f.date === day.fullDate) || null} 
                            size="small"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Studio Rows */}
            <div className="min-h-[600px]">
              {studios.map((studio) => (
                <div key={studio.id} className="flex border-b border-gray-200">
                  {/* Studio Label */}
                  <div className="w-16 border-r border-gray-200 bg-gray-50 p-2 flex items-center justify-center">
                    <div className="text-xs font-medium text-gray-600 transform -rotate-90 whitespace-nowrap">
                      {studio.name}
                    </div>
                  </div>
                  
                  {/* Studio Schedule Cells */}
                  {weekDays.map((day) => {
                    // Get bookings for this studio and day
                    const dayBookings = bookings.filter(booking => {
                      const bookingDate = toZonedTime(parseISO(booking.start), getFacilityTimezone_Dynamic());
                      return isSameDay(bookingDate, day.date);
                    });

                    return (
                      <div
                        key={`${studio.id}-${day.fullDate}`}
                        className="flex-1 min-w-[140px] border-r border-gray-200 min-h-[100px] relative bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        {dayBookings.length > 0 ? (
                          <div className="p-1 space-y-1">
                            {dayBookings.slice(0, 3).map((booking) => (
                              <div
                                key={booking.id}
                                className="p-1 rounded text-xs cursor-pointer transition-all bg-blue-100 border-blue-300 text-blue-800"
                                style={{ backgroundColor: booking.color || '#3B82F6', color: 'white' }}
                              >
                                <div className="font-medium truncate">{booking.title}</div>
                                <div className="text-xs opacity-80">
                                  {format(toZonedTime(parseISO(booking.start), getFacilityTimezone_Dynamic()), 'h:mm a')}
                                </div>
                              </div>
                            ))}
                            {dayBookings.length > 3 && (
                              <div className="text-xs text-gray-500 text-center">
                                +{dayBookings.length - 3} more
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-2 text-xs text-gray-400 text-center">
                            Available
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}