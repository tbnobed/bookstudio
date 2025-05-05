import { useState } from "react";
import { Header } from "@/components/layout/Header";
import StudioUsageChart from "@/components/reports/StudioUsageChart";
import { useQuery } from "@tanstack/react-query";
import { Booking, Studio } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatTimeRange } from "@/lib/dateUtils";
import { useAuth } from "@/hooks/use-auth";

export default function ReportsPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { user } = useAuth();
  
  // Get date range for this month
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
  
  // Fetch data
  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: [`/api/bookings?start=${monthStart.toISOString()}&end=${monthEnd.toISOString()}`],
  });
  
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });

  // Calculate key metrics
  const totalBookings = bookings.length;
  
  const totalStudioHours = bookings.reduce((total, booking) => {
    const start = new Date(booking.start);
    const end = new Date(booking.end);
    const durationInHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return total + durationInHours;
  }, 0);
  
  const bookingsByType = bookings.reduce((acc, booking) => {
    acc[booking.type] = (acc[booking.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const mostBookedStudio = studios.length > 0 ? 
    studios.map(studio => ({
      studio,
      bookings: bookings.filter(b => b.studioId === studio.id).length
    }))
    .sort((a, b) => b.bookings - a.bookings)[0]?.studio
    : null;

  // Format booking type for display
  const formatBookingType = (type: string) => {
    return type.replace("_", " ").split(" ").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
  };

  // Get studio name by ID
  const getStudioName = (studioId: number) => {
    const studio = studios.find(s => s.id === studioId);
    return studio ? studio.name : `Studio ${studioId}`;
  };

  // Get color for booking type
  const getBookingTypeColor = (type: string) => {
    switch (type) {
      case "production":
        return "bg-blue-100 text-blue-800";
      case "maintenance":
        return "bg-amber-100 text-amber-800";
      case "it_support":
        return "bg-red-100 text-red-800";
      case "rehearsal":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Header
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        view="month"
        onViewChange={() => {}}
        title="Reports"
      />
      
      <div className="container mx-auto p-4 pb-16 overflow-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Usage Reports & Analytics</h1>
          <p className="text-gray-500">Track studio bookings and optimize resource allocation</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalBookings}</div>
              <p className="text-xs text-gray-500">This month</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Studio Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStudioHours.toFixed(1)}</div>
              <p className="text-xs text-gray-500">Total hours booked</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Most Booked Studio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mostBookedStudio?.name || "N/A"}</div>
              <p className="text-xs text-gray-500">Highest utilization</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="mb-6">
          <StudioUsageChart />
        </div>

        {/* Booking Details */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Bookings</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>Booking Details</CardTitle>
              </CardHeader>
              <CardContent>
                {bookings.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    No bookings found for this period.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">Title</th>
                          <th className="text-left py-3 px-4 font-medium">Type</th>
                          <th className="text-left py-3 px-4 font-medium">Studio</th>
                          <th className="text-left py-3 px-4 font-medium">Date</th>
                          <th className="text-left py-3 px-4 font-medium">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.map(booking => (
                          <tr key={booking.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">{booking.title}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded text-xs ${getBookingTypeColor(booking.type)}`}>
                                {formatBookingType(booking.type)}
                              </span>
                            </td>
                            <td className="py-3 px-4">{getStudioName(booking.studioId)}</td>
                            <td className="py-3 px-4">{formatDate(booking.start)}</td>
                            <td className="py-3 px-4">{formatTimeRange(booking.start, booking.end)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="production">
            <Card>
              <CardHeader>
                <CardTitle>Production Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                {bookings.filter(b => b.type === "production").length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    No production bookings found for this period.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">Title</th>
                          <th className="text-left py-3 px-4 font-medium">Studio</th>
                          <th className="text-left py-3 px-4 font-medium">Date</th>
                          <th className="text-left py-3 px-4 font-medium">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings
                          .filter(b => b.type === "production")
                          .map(booking => (
                            <tr key={booking.id} className="border-b hover:bg-gray-50">
                              <td className="py-3 px-4">{booking.title}</td>
                              <td className="py-3 px-4">{getStudioName(booking.studioId)}</td>
                              <td className="py-3 px-4">{formatDate(booking.start)}</td>
                              <td className="py-3 px-4">{formatTimeRange(booking.start, booking.end)}</td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="maintenance">
            <Card>
              <CardHeader>
                <CardTitle>Maintenance Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                {bookings.filter(b => b.type === "maintenance").length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    No maintenance bookings found for this period.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">Title</th>
                          <th className="text-left py-3 px-4 font-medium">Studio</th>
                          <th className="text-left py-3 px-4 font-medium">Date</th>
                          <th className="text-left py-3 px-4 font-medium">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings
                          .filter(b => b.type === "maintenance")
                          .map(booking => (
                            <tr key={booking.id} className="border-b hover:bg-gray-50">
                              <td className="py-3 px-4">{booking.title}</td>
                              <td className="py-3 px-4">{getStudioName(booking.studioId)}</td>
                              <td className="py-3 px-4">{formatDate(booking.start)}</td>
                              <td className="py-3 px-4">{formatTimeRange(booking.start, booking.end)}</td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
