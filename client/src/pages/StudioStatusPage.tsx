import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tv, MonitorPlay, Clock, Calendar, Wrench, AlertTriangle } from "lucide-react";
import { format, isAfter, isBefore } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";

interface Studio {
  id: number;
  name: string;
  description: string | null;
  status: 'available' | 'in_use' | 'maintenance';
}

interface Booking {
  id: number;
  title: string;
  start: string;
  end: string;
  studioId: number | null;
  status: string;
  type: string;
}

const TIMEZONE = "America/Chicago";

export default function StudioStatusPage() {
  const { data: studios = [], isLoading: studiosLoading } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
  });

  const { data: siteName } = useQuery({
    queryKey: ["/api/system/site-name"],
  });

  const now = new Date();

  const getStudioStatus = (studio: Studio) => {
    // Check for active bookings in this studio
    const activeBooking = bookings.find(booking => {
      if (booking.studioId !== studio.id) return false;
      
      const start = new Date(booking.start);
      const end = new Date(booking.end);
      
      return start <= now && end > now;
    });

    if (activeBooking) {
      return {
        status: 'in_use' as const,
        booking: activeBooking,
        statusText: 'In Use',
        statusColor: 'bg-red-100 text-red-800 border-red-200',
        iconColor: 'text-red-600'
      };
    }

    // Check for upcoming bookings
    const upcomingBooking = bookings
      .filter(booking => {
        if (booking.studioId !== studio.id) return false;
        const start = new Date(booking.start);
        return isAfter(start, now);
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];

    if (upcomingBooking) {
      const nextStart = new Date(upcomingBooking.start);
      const timeUntil = Math.round((nextStart.getTime() - now.getTime()) / (1000 * 60)); // minutes
      
      return {
        status: 'available' as const,
        booking: upcomingBooking,
        statusText: timeUntil < 60 ? `Available (${timeUntil}m until next)` : 'Available',
        statusColor: 'bg-green-100 text-green-800 border-green-200',
        iconColor: 'text-green-600'
      };
    }

    // Check for maintenance status
    if (studio.status === 'maintenance') {
      return {
        status: 'maintenance' as const,
        booking: null,
        statusText: 'Maintenance',
        statusColor: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        iconColor: 'text-yellow-600'
      };
    }

    return {
      status: 'available' as const,
      booking: null,
      statusText: 'Available',
      statusColor: 'bg-green-100 text-green-800 border-green-200',
      iconColor: 'text-green-600'
    };
  };

  const getNextBooking = (studio: Studio) => {
    return bookings
      .filter(booking => {
        if (booking.studioId !== studio.id) return false;
        const start = new Date(booking.start);
        return isAfter(start, now);
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];
  };

  const getRecentBooking = (studio: Studio) => {
    return bookings
      .filter(booking => {
        if (booking.studioId !== studio.id) return false;
        const end = new Date(booking.end);
        return isBefore(end, now);
      })
      .sort((a, b) => new Date(b.end).getTime() - new Date(a.end).getTime())[0];
  };

  if (studiosLoading || bookingsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Studio Status</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const availableStudios = studios.filter(studio => getStudioStatus(studio).status === 'available').length;
  const inUseStudios = studios.filter(studio => getStudioStatus(studio).status === 'in_use').length;
  const maintenanceStudios = studios.filter(studio => getStudioStatus(studio).status === 'maintenance').length;

  return (
    <div className="container mx-auto p-6">
      {/* Site Name Banner */}
      {siteName && (
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 text-center mb-6 rounded-lg">
          <h1 className="text-lg font-bold">{siteName} - Studio Status</h1>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Available</p>
                <p className="text-2xl font-bold text-green-600">{availableStudios}</p>
              </div>
              <Tv className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Use</p>
                <p className="text-2xl font-bold text-red-600">{inUseStudios}</p>
              </div>
              <MonitorPlay className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Maintenance</p>
                <p className="text-2xl font-bold text-yellow-600">{maintenanceStudios}</p>
              </div>
              <Wrench className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Time */}
      <div className="text-center mb-6">
        <p className="text-sm text-gray-600">Current Time (Chicago)</p>
        <p className="text-xl font-mono font-bold">
          {formatInTimeZone(now, TIMEZONE, "h:mm:ss a 'CDT'")}
        </p>
        <p className="text-sm text-gray-500">
          {formatInTimeZone(now, TIMEZONE, "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      {/* Studio Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {studios.map(studio => {
          const studioStatus = getStudioStatus(studio);
          const nextBooking = getNextBooking(studio);
          const recentBooking = getRecentBooking(studio);

          return (
            <Card key={studio.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Tv className={cn("h-5 w-5", studioStatus.iconColor)} />
                    {studio.name}
                  </CardTitle>
                  <Badge className={studioStatus.statusColor}>
                    {studioStatus.statusText}
                  </Badge>
                </div>
                {studio.description && (
                  <p className="text-sm text-gray-600">{studio.description}</p>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Current Activity */}
                {studioStatus.booking && studioStatus.status === 'in_use' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <MonitorPlay className="h-4 w-4 text-red-600" />
                      <span className="font-medium text-red-800">Currently Recording</span>
                    </div>
                    <p className="text-sm font-medium text-red-900">
                      {studioStatus.booking.title}
                    </p>
                    <p className="text-xs text-red-700">
                      Ends at {formatInTimeZone(new Date(studioStatus.booking.end), TIMEZONE, "h:mm a")}
                    </p>
                  </div>
                )}

                {/* Next Booking */}
                {nextBooking && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-800">Next Booking</span>
                    </div>
                    <p className="text-sm font-medium text-blue-900">
                      {nextBooking.title}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-blue-700">
                      <Clock className="h-3 w-3" />
                      {formatInTimeZone(new Date(nextBooking.start), TIMEZONE, "h:mm a")} - 
                      {formatInTimeZone(new Date(nextBooking.end), TIMEZONE, "h:mm a")}
                    </div>
                    {format(new Date(nextBooking.start), "yyyy-MM-dd") !== format(now, "yyyy-MM-dd") && (
                      <p className="text-xs text-blue-600 mt-1">
                        {formatInTimeZone(new Date(nextBooking.start), TIMEZONE, "MMM d")}
                      </p>
                    )}
                  </div>
                )}

                {/* Recent Activity */}
                {!nextBooking && recentBooking && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-gray-600" />
                      <span className="font-medium text-gray-800">Last Used</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      {recentBooking.title}
                    </p>
                    <p className="text-xs text-gray-600">
                      Ended {formatInTimeZone(new Date(recentBooking.end), TIMEZONE, "h:mm a")}
                      {format(new Date(recentBooking.end), "yyyy-MM-dd") !== format(now, "yyyy-MM-dd") && 
                        ` on ${formatInTimeZone(new Date(recentBooking.end), TIMEZONE, "MMM d")}`
                      }
                    </p>
                  </div>
                )}

                {/* No Activity */}
                {!nextBooking && !recentBooking && studioStatus.status === 'available' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <Tv className="h-8 w-8 text-green-400 mx-auto mb-2" />
                    <p className="text-sm text-green-800 font-medium">Ready for use</p>
                    <p className="text-xs text-green-600">No recent or upcoming bookings</p>
                  </div>
                )}

                {/* Maintenance Status */}
                {studioStatus.status === 'maintenance' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                    <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                    <p className="text-sm text-yellow-800 font-medium">Under Maintenance</p>
                    <p className="text-xs text-yellow-600">Studio temporarily unavailable</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}