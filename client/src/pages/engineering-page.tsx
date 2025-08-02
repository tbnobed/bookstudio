import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Settings, Calendar, AlertTriangle, Camera, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWeatherForecast } from "@/hooks/useWeatherForecast";
import WeatherForecastCell from "@/components/calendar/WeatherForecastCell";
import { Header } from "@/components/layout/Header";
import TimelineCalendar from "@/components/calendar/TimelineCalendar";

interface Studio {
  id: number;
  name: string;
  description: string | null;
  status: string;
}

interface Alert {
  id: number;
  title: string;
  description: string | null;
  severity: string;
  startTime: string | null;
  endTime: string | null;
  isActive: boolean;
}

export default function EngineeringPage() {
  const [currentWeek, setCurrentWeek] = useState(() => {
    const now = new Date();
    return startOfWeek(now, { weekStartsOn: 1 }); // Monday = 1
  });

  // Fetch studios
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });

  // Fetch alerts
  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Get weather forecast
  const { forecast } = useWeatherForecast();

  // Navigation functions
  const goToPreviousWeek = () => {
    setCurrentWeek(prev => subWeeks(prev, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeek(prev => addWeeks(prev, 1));
  };

  const goToCurrentWeek = () => {
    const now = new Date();
    setCurrentWeek(startOfWeek(now, { weekStartsOn: 1 }));
  };

  // Generate week range text
  const formatWeekRange = (weekStart: Date) => {
    const weekEnd = addDays(weekStart, 6);
    
    if (weekStart.getMonth() === weekEnd.getMonth()) {
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'd, yyyy')}`;
    } else if (weekStart.getFullYear() === weekEnd.getFullYear()) {
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    } else {
      return `${format(weekStart, 'MMM d, yyyy')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    }
  };

  // Check if current week is the actual current week
  const isCurrentWeek = () => {
    const now = new Date();
    const actualCurrentWeek = startOfWeek(now, { weekStartsOn: 1 });
    return isSameDay(currentWeek, actualCurrentWeek);
  };

  // Get active alerts count
  const activeAlertsCount = alerts.filter(alert => alert.isActive).length;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Header 
        currentDate={currentWeek}
        onDateChange={setCurrentWeek}
        view="timeline"
        onViewChange={() => {}}
        title="Engineering View"
        showViewToggle={false}
        useMondayWeeks={true}
      />
      
      <div className="flex-1 overflow-hidden">
        <div className="h-full p-4">
          <div className="flex flex-col h-full">
            {/* Header Section */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Monitor className="h-6 w-6" />
                  Engineering View
                </h1>
                
                {/* Active Alerts Badge */}
                {activeAlertsCount > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="destructive" className="cursor-pointer">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {activeAlertsCount} Active Alert{activeAlertsCount > 1 ? 's' : ''}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="max-w-xs">
                          <div className="font-semibold mb-2">Active Alerts:</div>
                          {alerts.filter(alert => alert.isActive).map(alert => (
                            <div key={alert.id} className="text-sm mb-1">
                              <span className="font-medium">{alert.title}</span>
                              {alert.description && (
                                <div className="text-xs opacity-90">{alert.description}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              {/* Week Navigation */}
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousWeek}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                <div className="text-center min-w-[200px]">
                  <div className="text-lg font-semibold text-gray-900">
                    {formatWeekRange(currentWeek)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Week of {format(currentWeek, 'MMMM d, yyyy')}
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextWeek}
                  className="flex items-center gap-2"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
                
                {!isCurrentWeek() && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={goToCurrentWeek}
                    className="flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    Today
                  </Button>
                )}
              </div>
            </div>

            {/* Timeline Calendar */}
            <div className="flex-1 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <TimelineCalendar 
                currentDate={currentWeek}
                selectedStudioIds={[]}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}