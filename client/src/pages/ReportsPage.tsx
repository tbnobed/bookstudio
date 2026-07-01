import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import StudioUsageChart from "@/components/reports/StudioUsageChart";
import StudioBookingsReport from "@/components/reports/StudioBookingsReport";
import { useQuery } from "@tanstack/react-query";
import { Booking, Studio, BookingStudio } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate, formatTimeRange } from "@/lib/dateUtils";
import { useAuth } from "@/hooks/use-auth";

const PAGE_SIZE = 15;

interface BookingTableProps {
  rows: Booking[];
  showType?: boolean;
  emptyMessage: string;
  getStudioName: (bookingId: number) => string;
  getBookingTypeColor: (type: string) => string;
  formatBookingType: (type: string) => string;
}

function BookingTable({
  rows,
  showType = false,
  emptyMessage,
  getStudioName,
  getBookingTypeColor,
  formatBookingType,
}: BookingTableProps) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  if (rows.length === 0) {
    return <div className="text-center py-4 text-gray-500">{emptyMessage}</div>;
  }

  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(startIdx, startIdx + PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="overflow-auto max-h-[55vh] rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b">
              <th className="text-left py-3 px-4 font-medium">Title</th>
              {showType && <th className="text-left py-3 px-4 font-medium">Type</th>}
              <th className="text-left py-3 px-4 font-medium">Studio</th>
              <th className="text-left py-3 px-4 font-medium">Date</th>
              <th className="text-left py-3 px-4 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(booking => (
              <tr key={booking.id} className="border-b hover:bg-muted/50 transition-colors">
                <td className="py-3 px-4">{booking.title}</td>
                {showType && (
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs ${getBookingTypeColor(booking.type)}`}>
                      {formatBookingType(booking.type)}
                    </span>
                  </td>
                )}
                <td className="py-3 px-4">{getStudioName(booking.id)}</td>
                <td className="py-3 px-4">{formatDate(booking.start)}</td>
                <td className="py-3 px-4">{formatTimeRange(booking.start, booking.end)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            Showing {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, rows.length)} of {rows.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <span className="text-muted-foreground">Page {safePage} of {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { user } = useAuth();
  const [bookingStudioMap, setBookingStudioMap] = useState<Record<number, number[]>>({});
  
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

  const { data: bookingStudios = [] } = useQuery<BookingStudio[]>({
    queryKey: ["/api/booking-studios"],
  });

  // Process booking-studio relationships
  useEffect(() => {
    if (bookingStudios.length > 0) {
      const studioMap: Record<number, number[]> = {};
      
      bookingStudios.forEach(bs => {
        if (!studioMap[bs.bookingId]) {
          studioMap[bs.bookingId] = [];
        }
        studioMap[bs.bookingId].push(bs.studioId);
      });
      
      setBookingStudioMap(studioMap);
    }
  }, [bookingStudios]);

  // Calculate key metrics
  const totalBookings = bookings.length;
  
  const totalStudioHours = bookings.reduce((total, booking) => {
    const start = new Date(booking.start);
    const end = new Date(booking.end);
    const durationInHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    // Multiply by the number of studios if it's a multi-studio booking
    const studioCount = bookingStudioMap[booking.id]?.length || 1;
    return total + (durationInHours * studioCount);
  }, 0);
  
  const bookingsByType = bookings.reduce((acc, booking) => {
    acc[booking.type] = (acc[booking.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Calculate most booked studio
  const studioBookingCounts = studios.map(studio => {
    // Count direct bookings (legacy)
    let directBookings = bookings.filter(b => b.studioId === studio.id).length;
    
    // Count bookings via junction table
    let junctionBookings = 0;
    Object.entries(bookingStudioMap).forEach(([bookingId, studioIds]) => {
      if (studioIds.includes(studio.id)) {
        junctionBookings++;
      }
    });
    
    return {
      studio,
      bookings: directBookings + junctionBookings
    };
  });
  
  const mostBookedStudio = studioBookingCounts.length > 0 ? 
    studioBookingCounts.sort((a, b) => b.bookings - a.bookings)[0]?.studio
    : null;

  // Format booking type for display
  const formatBookingType = (type: string) => {
    return type.replace("_", " ").split(" ").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
  };

  // Get studio name by ID - supports multi-studio bookings
  const getStudioName = (bookingId: number) => {
    // If using multi-studio bookings
    if (bookingStudioMap[bookingId] && bookingStudioMap[bookingId].length > 0) {
      const studioNames = bookingStudioMap[bookingId].map(studioId => {
        const studio = studios.find(s => s.id === studioId);
        return studio ? studio.name : `Studio ${studioId}`;
      });
      
      return studioNames.join(", ");
    }
    
    // Legacy single studio booking
    const booking = bookings.find(b => b.id === bookingId);
    if (booking && booking.studioId) {
      const studio = studios.find(s => s.id === booking.studioId);
      return studio ? studio.name : `Studio ${booking.studioId}`;
    }
    
    return "No Studio";
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
        return "bg-gray-100 text-neutral-800";
    }
  };

  // Check if user is a producer - they should not have access to reports
  if (user?.role === "producer") {
    return (
      <div className="flex flex-col h-screen">
        <Header
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          view="month"
          onViewChange={() => {}}
          title="Reports"
          showViewToggle={false}
        />
        <div className="container mx-auto p-4 flex items-center justify-center h-full">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="flex mb-4 gap-2 justify-center text-amber-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <h1 className="text-2xl font-bold">Access Denied</h1>
              </div>
              <p className="text-center text-gray-600">
                You don't have permission to access the Reports page. Only administrators, engineers, and IT staff can view reports.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <Header
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        view="month"
        onViewChange={() => {}}
        title="Reports"
        showViewToggle={false}
      />
      
      <div className="container mx-auto p-4 pb-16 overflow-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Usage Reports & Analytics</h1>
          <p className="text-gray-500">Track studio bookings and optimize resource allocation</p>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="studio-bookings">Studio Bookings</TabsTrigger>
          </TabsList>

          <TabsContent value="studio-bookings">
            <StudioBookingsReport />
          </TabsContent>

          <TabsContent value="overview">
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
                <BookingTable
                  rows={bookings}
                  showType
                  emptyMessage="No bookings found for this period."
                  getStudioName={getStudioName}
                  getBookingTypeColor={getBookingTypeColor}
                  formatBookingType={formatBookingType}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="production">
            <Card>
              <CardHeader>
                <CardTitle>Production Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                <BookingTable
                  rows={bookings.filter(b => b.type === "production")}
                  emptyMessage="No production bookings found for this period."
                  getStudioName={getStudioName}
                  getBookingTypeColor={getBookingTypeColor}
                  formatBookingType={formatBookingType}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="maintenance">
            <Card>
              <CardHeader>
                <CardTitle>Maintenance Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                <BookingTable
                  rows={bookings.filter(b => b.type === "maintenance")}
                  emptyMessage="No maintenance bookings found for this period."
                  getStudioName={getStudioName}
                  getBookingTypeColor={getBookingTypeColor}
                  formatBookingType={formatBookingType}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
