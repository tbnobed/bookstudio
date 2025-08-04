import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle, User, Clock, Search, Filter } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";

interface Booking {
  id: number;
  title: string;
  description: string;
  user_id: number;
  start: string;
  end: string;
  type: string;
  status: string;
  created_at: string;
}

interface User {
  id: number;
  username: string;
  display_name: string;
  role: string;
}

interface CorruptionStats {
  total_bookings: number;
  admin_bookings: number;
  admin_percentage: number;
  health_status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

export default function AdminBookingOwnership() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedBookings, setSelectedBookings] = useState<Set<number>>(new Set());

  // Check if user is admin
  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Access Denied
            </CardTitle>
            <CardDescription>
              This page is only available to system administrators.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Fetch corruption statistics
  const { data: stats } = useQuery<CorruptionStats>({
    queryKey: ["/api/admin/booking-ownership/stats"],
  });

  // Fetch admin-owned bookings
  const { data: adminBookings = [], isLoading: loadingBookings } = useQuery<Booking[]>({
    queryKey: ["/api/admin/booking-ownership/admin-bookings"],
  });

  // Fetch all users for assignment
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Update booking ownership mutation
  const updateOwnershipMutation = useMutation({
    mutationFn: async ({ bookingIds, newUserId }: { bookingIds: number[], newUserId: number }) => {
      const response = await apiRequest("POST", "/api/admin/booking-ownership/update", {
        booking_ids: bookingIds,
        new_user_id: newUserId
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-ownership/admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-ownership/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      
      setSelectedBookings(new Set());
      toast({
        title: "Ownership Updated",
        description: `Successfully updated ${data.updated_count} booking(s)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter bookings based on search and type
  const filteredBookings = adminBookings.filter(booking => {
    const matchesSearch = booking.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || booking.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Get unique booking types for filter
  const bookingTypes = Array.from(new Set(adminBookings.map(b => b.type)));

  const handleBulkUpdate = () => {
    if (selectedBookings.size === 0 || !selectedUserId) {
      toast({
        title: "Selection Required",
        description: "Please select bookings and a new owner",
        variant: "destructive",
      });
      return;
    }

    updateOwnershipMutation.mutate({
      bookingIds: Array.from(selectedBookings),
      newUserId: parseInt(selectedUserId)
    });
  };

  const handleSelectAll = () => {
    if (selectedBookings.size === filteredBookings.length) {
      setSelectedBookings(new Set());
    } else {
      setSelectedBookings(new Set(filteredBookings.map(b => b.id)));
    }
  };

  const toggleBookingSelection = (bookingId: number) => {
    const newSelected = new Set(selectedBookings);
    if (newSelected.has(bookingId)) {
      newSelected.delete(bookingId);
    } else {
      newSelected.add(bookingId);
    }
    setSelectedBookings(newSelected);
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY': return 'bg-green-100 text-green-800';
      case 'WARNING': return 'bg-yellow-100 text-yellow-800';
      case 'CRITICAL': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Booking Ownership Management</h1>
          <p className="text-muted-foreground">
            Review and correct booking ownership assignments
          </p>
        </div>
      </div>

      {/* Corruption Statistics */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              System Health Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.total_bookings}</div>
                <div className="text-sm text-muted-foreground">Total Bookings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.admin_bookings}</div>
                <div className="text-sm text-muted-foreground">Admin Owned</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.admin_percentage}%</div>
                <div className="text-sm text-muted-foreground">Admin Percentage</div>
              </div>
              <div className="text-center">
                <Badge className={getHealthStatusColor(stats.health_status)}>
                  {stats.health_status}
                </Badge>
                <div className="text-sm text-muted-foreground mt-1">Health Status</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Bulk Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Filter & Bulk Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Search Bookings</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search title, description, or type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label>Filter by Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {bookingTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assign to User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new owner..." />
                </SelectTrigger>
                <SelectContent>
                  {users.filter(u => u.id !== 1).map(user => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.display_name} (@{user.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              onClick={handleSelectAll}
              variant="outline"
              size="sm"
            >
              {selectedBookings.size === filteredBookings.length ? "Deselect All" : "Select All"}
            </Button>
            <div className="text-sm text-muted-foreground">
              {selectedBookings.size} booking(s) selected
            </div>
            <Button
              onClick={handleBulkUpdate}
              disabled={selectedBookings.size === 0 || !selectedUserId || updateOwnershipMutation.isPending}
              className="ml-auto"
            >
              {updateOwnershipMutation.isPending ? "Updating..." : "Update Selected"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bookings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Admin-Owned Bookings ({filteredBookings.length})</CardTitle>
          <CardDescription>
            Bookings currently assigned to admin that may need reassignment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingBookings ? (
            <div className="text-center py-8">Loading bookings...</div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || typeFilter !== "all" ? 
                "No bookings match your filters" : 
                "No admin-owned bookings found"
              }
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedBookings.size === filteredBookings.length && filteredBookings.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedBookings.has(booking.id)}
                          onChange={() => toggleBookingSelection(booking.id)}
                          className="rounded border-gray-300"
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{booking.title}</div>
                          {booking.description && (
                            <div className="text-sm text-muted-foreground truncate max-w-xs">
                              {booking.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {booking.type.charAt(0).toUpperCase() + booking.type.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {booking.start && !isNaN(new Date(booking.start).getTime()) 
                            ? format(new Date(booking.start), "MMM d, yyyy")
                            : "Invalid Date"
                          }
                          <br />
                          <span className="text-muted-foreground">
                            {booking.start && booking.end && 
                             !isNaN(new Date(booking.start).getTime()) && 
                             !isNaN(new Date(booking.end).getTime())
                              ? `${format(new Date(booking.start), "h:mm a")} - ${format(new Date(booking.end), "h:mm a")}`
                              : "Invalid Time"
                            }
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={booking.status === 'confirmed' ? 'default' : 
                                  booking.status === 'tentative' ? 'secondary' : 'destructive'}
                        >
                          {booking.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {booking.created_at && booking.created_at !== null && !isNaN(new Date(booking.created_at).getTime())
                          ? format(new Date(booking.created_at), "MMM d, yyyy")
                          : "N/A"
                        }
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedBookings(new Set([booking.id]));
                          }}
                        >
                          <User className="h-4 w-4 mr-1" />
                          Select
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}