import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Booking, Studio, BookingStudio } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { addDays, subtractDays, addMonths, subtractMonths } from "@/lib/dateUtils";

interface StudioUsageChartProps {
  view?: "bar" | "pie" | "line";
  timeframe?: "week" | "month" | "year";
}

export default function StudioUsageChart({ 
  view = "bar", 
  timeframe = "month" 
}: StudioUsageChartProps) {
  const [selectedView, setSelectedView] = useState(view);
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe);
  const [chartData, setChartData] = useState<any[]>([]);
  const [bookingStudioMap, setBookingStudioMap] = useState<Record<number, number[]>>({});

  // Get date range based on timeframe
  const getDateRange = () => {
    const now = new Date();
    let start: Date, end: Date;
    
    switch (selectedTimeframe) {
      case "week":
        start = subtractDays(now, 7);
        end = now;
        break;
      case "month":
        start = subtractMonths(now, 1);
        end = now;
        break;
      case "year":
        start = new Date(now.getFullYear(), 0, 1); // Start of current year
        end = now;
        break;
      default:
        start = subtractMonths(now, 1);
        end = now;
    }
    
    return { start, end };
  };

  // Fetch bookings data
  const { start, end } = getDateRange();
  
  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: [`/api/bookings?start=${start.toISOString()}&end=${end.toISOString()}`],
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

  // Process data for charts
  useEffect(() => {
    if (!bookings.length || !studios.length) return;
    
    if (selectedView === "bar" || selectedView === "line") {
      // For bar chart, count bookings per studio
      const studioUsage = studios.map(studio => {
        // Count legacy single studio bookings
        const directBookings = bookings.filter(booking => booking.studioId === studio.id);
        
        // Count bookings from the junction table
        const junctionBookings = bookings.filter(booking => {
          const studioIds = bookingStudioMap[booking.id] || [];
          return studioIds.includes(studio.id);
        });
        
        // Combine both types to get all bookings for this studio
        const allStudioBookings = [...directBookings];
        junctionBookings.forEach(jb => {
          // Only add if not already in the array (to avoid duplicates)
          if (!allStudioBookings.some(b => b.id === jb.id)) {
            allStudioBookings.push(jb);
          }
        });
        
        const totalHours = allStudioBookings.reduce((total, booking) => {
          const start = new Date(booking.start);
          const end = new Date(booking.end);
          const durationInHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          return total + durationInHours;
        }, 0);
        
        return {
          name: studio.name,
          bookings: allStudioBookings.length,
          hours: Math.round(totalHours * 10) / 10,
        };
      });
      
      // Sort by usage
      studioUsage.sort((a, b) => b.bookings - a.bookings);
      
      setChartData(studioUsage);
    } else if (selectedView === "pie") {
      // For pie chart, group by booking type
      const typeCount: Record<string, number> = {};
      
      bookings.forEach(booking => {
        if (typeCount[booking.type]) {
          typeCount[booking.type]++;
        } else {
          typeCount[booking.type] = 1;
        }
      });
      
      const pieData = Object.entries(typeCount).map(([name, value]) => ({
        name: name.replace("_", " ").split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" "),
        value,
      }));
      
      setChartData(pieData);
    }
  }, [bookings, studios, bookingStudioMap, selectedView, selectedTimeframe]);

  // Colors for the pie chart
  const COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444'];

  // Title based on timeframe
  const getTimeframeTitle = () => {
    switch (selectedTimeframe) {
      case "week":
        return "Past Week";
      case "month":
        return "Past Month";
      case "year":
        return "This Year";
      default:
        return "Past Month";
    }
  };

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border border-gray-200 shadow-sm rounded">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value} {entry.name === "hours" ? "hrs" : ""}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="w-full h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-md font-medium">Studio Usage - {getTimeframeTitle()}</CardTitle>
        <div className="flex gap-2">
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Past Week</SelectItem>
              <SelectItem value="month">Past Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedView} onValueChange={setSelectedView}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Chart Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bar">Bar Chart</SelectItem>
              <SelectItem value="pie">Pie Chart</SelectItem>
              <SelectItem value="line">Line Chart</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="h-[400px]">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            {selectedView === "bar" ? (
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 70 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={70} />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="bookings" fill="#3B82F6" name="Number of Bookings" />
                <Bar dataKey="hours" fill="#8B5CF6" name="Total Hours" />
              </BarChart>
            ) : selectedView === "pie" ? (
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 70 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={70} />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="bookings" stroke="#3B82F6" name="Number of Bookings" />
                <Line type="monotone" dataKey="hours" stroke="#8B5CF6" name="Total Hours" />
              </LineChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            No data available for the selected timeframe
          </div>
        )}
      </CardContent>
    </Card>
  );
}
