import { HoverCardContent } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, XCircle, CalendarDays, Clock, Tag, Camera, Tv, User, AlertTriangle, Bookmark } from "lucide-react";
import { format } from "date-fns";
import { formatTime } from "@/lib/dateUtils";

// Helper function to format booking types
const formatBookingType = (type: string) => {
  if (!type) return "Unknown";
  return type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
};

interface BookingHoverCardProps {
  booking: any;
  studios?: any[];
  pcrRooms?: any[];
  notificationGroups: any[];
  bookingStudioLinks: any[];
  isAlert?: boolean;
  onEdit?: () => void;
}

export function BookingHoverCard({ 
  booking, 
  studios = [], 
  pcrRooms = [], 
  notificationGroups, 
  bookingStudioLinks,
  isAlert = false,
  onEdit 
}: BookingHoverCardProps) {
  // Get studios for booking
  const getStudiosForBooking = (booking: any) => {
    const studioList: typeof studios = [];
    
    // Check direct studio assignment
    if (booking.studioId) {
      const studio = studios.find(s => s.id === booking.studioId);
      if (studio) {
        studioList.push(studio);
      }
    }
    
    // Look through bookingStudioLinks for this booking's ID
    const links = bookingStudioLinks.filter((link: any) => link.bookingId === booking.id);
    if (links && links.length > 0) {
      links.forEach((link: any) => {
        const studio = studios.find(s => s.id === link.studioId);
        if (studio && !studioList.some(s => s.id === studio.id)) {
          studioList.push(studio);
        }
      });
    }
    
    return studioList;
  };

  // Get PCR room
  const getPcrRoom = (booking: any) => {
    if (!booking.pcrRoomId) return null;
    return pcrRooms.find(pcr => pcr.id === booking.pcrRoomId);
  };

  const studiosList = getStudiosForBooking(booking);
  const pcrRoom = getPcrRoom(booking);

  // Determine severity color based on booking type or severity
  const getSeverityColor = () => {
    if (isAlert) {
      switch (booking.severity) {
        case 'critical': return '#dc2626'; // red-600
        case 'high': return '#ea580c'; // orange-600
        case 'medium': return '#d97706'; // amber-600
        case 'low': return '#2563eb'; // blue-600
        default: return '#6b7280'; // gray-500
      }
    }
    
    // For regular bookings, use custom color or default
    return booking.color || '#6b7280';
  };

  const severityColor = getSeverityColor();

  return (
    <HoverCardContent className="w-96">
      <div className="flex justify-between">
        <div className="flex-1">
          <h4 className="text-sm font-semibold">{booking.title}</h4>
          <p className="text-sm text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 inline-block mr-1" />
            {format(new Date(booking.start), 'MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Status indicator */}
          <div className="flex items-center gap-1">
            {booking.status === 'confirmed' && <CheckCircle className="h-4 w-4 text-green-600" />}
            {booking.status === 'tentative' && <AlertCircle className="h-4 w-4 text-yellow-600" />}
            {booking.status === 'cancelled' && <XCircle className="h-4 w-4 text-red-600" />}
            <span className="text-xs font-medium capitalize">{booking.status}</span>
          </div>
          <div 
            className="h-12 w-12 rounded-full" 
            style={{ 
              backgroundColor: severityColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}
          >
            {isAlert ? <AlertTriangle className="h-6 w-6" /> : <Bookmark className="h-6 w-6" />}
          </div>
        </div>
      </div>
      
      <div className="mt-3">
        <h5 className="text-xs font-medium mb-1">Description</h5>
        <p className="text-xs text-gray-600">
          {booking.description || "No description provided."}
        </p>
      </div>
      
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <h5 className="text-xs font-medium mb-1 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Time
          </h5>
          <p className="text-xs">
            {formatTime(new Date(booking.start))} - {formatTime(new Date(booking.end))}
          </p>
        </div>
        {isAlert ? (
          <div>
            <h5 className="text-xs font-medium mb-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Severity
            </h5>
            <p className="text-xs capitalize">{booking.severity || 'Normal'}</p>
          </div>
        ) : (
          <div>
            <h5 className="text-xs font-medium mb-1 flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Type
            </h5>
            <p className="text-xs capitalize">{formatBookingType(booking.type)}</p>
          </div>
        )}
        
        {!isAlert && (
          <>
            <div className="col-span-2">
              <h5 className="text-xs font-medium mb-1 flex items-center gap-1">
                <Camera className="h-3 w-3" />
                Studios
              </h5>
              <div className="flex flex-wrap gap-1">
                {studiosList.map(studio => (
                  <Badge key={studio.id} variant="outline" className="text-[10px]">
                    {studio.name}
                  </Badge>
                ))}
              </div>
            </div>
            {pcrRoom && (
              <div>
                <h5 className="text-xs font-medium mb-1 flex items-center gap-1">
                  <Tv className="h-3 w-3" />
                  PCR Room
                </h5>
                <p className="text-xs">{pcrRoom.name}</p>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Notification Groups */}
      {Array.isArray(booking.notifyList) && booking.notifyList.length > 0 && (
        <div className="mt-3">
          <h5 className="text-xs font-medium mb-1 flex items-center gap-1">
            <User className="h-3 w-3" />
            Notifying
          </h5>
          <div className="flex flex-wrap gap-1">
            {booking.notifyList.map((groupId: string | number, i: number) => {
              const group = notificationGroups.find(g => g.id.toString() === groupId.toString());
              return (
                <Badge key={i} variant="secondary" className="text-[10px]">
                  {group ? group.name : `Group ${groupId}`}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Created date */}
      {booking.createdAt && (
        <div className="mt-3 pt-2 border-t border-gray-100">
          <p className="text-[10px] text-gray-500">
            Created {format(new Date(booking.createdAt), 'MMM d, yyyy HH:mm')}
          </p>
        </div>
      )}
    </HoverCardContent>
  );
}