import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { 
  CalendarIcon, 
  Search, 
  Filter, 
  Download, 
  Trash2,
  User,
  Activity,
  Database,
  Clock,
  Eye,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getFacilityTimezone_Dynamic } from "@/lib/dateUtils";

interface AuditLog {
  id: number;
  userId: number;
  action: string;
  entityType: string;
  entityId?: number;
  entityTitle?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  user?: {
    name: string;
    username: string;
    role: string;
  } | null;
}

interface AuditLogStats {
  total: number;
  byAction: Array<{ action: string; count: number }>;
  byEntity: Array<{ entityType: string; count: number }>;
}

const ACTION_COLORS = {
  CREATE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  LOGIN: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  LOGOUT: "bg-gray-100 text-neutral-800 dark:bg-neutral-900 dark:text-gray-300",
  LOGIN_FAILED: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  CLEANUP: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
};

const ENTITY_ICONS = {
  booking: Activity,
  user: User,
  alert: Database,
  template: Database,
  authentication: User,
  system_setting: Database,
  audit_logs: Trash2
};

export default function AuditLogsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State for filters
  const [filters, setFilters] = useState({
    userId: "",
    action: "",
    entityType: "",
    startDate: null as Date | null,
    endDate: null as Date | null,
    searchTerm: ""
  });
  
  // State for pagination
  const [pagination, setPagination] = useState({
    offset: 0,
    limit: 50
  });
  
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Check if user has access
  if (!user || !["admin", "site_manager"].includes(user.role)) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Database className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Access Denied</h3>
              <p className="text-muted-foreground">
                You don't have permission to view audit logs.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Build query parameters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", pagination.limit.toString());
    params.set("offset", pagination.offset.toString());
    
    if (filters.userId) params.set("userId", filters.userId);
    if (filters.action) params.set("action", filters.action);
    if (filters.entityType) params.set("entityType", filters.entityType);
    if (filters.startDate) params.set("startDate", filters.startDate.toISOString());
    if (filters.endDate) params.set("endDate", filters.endDate.toISOString());
    
    return params.toString();
  }, [filters, pagination]);

  // Fetch audit logs
  const { data: auditData, isLoading: logsLoading } = useQuery({
    queryKey: ["/api/audit-logs", queryParams],
    queryFn: async () => {
      const response = await fetch(`/api/audit-logs?${queryParams}`);
      if (!response.ok) throw new Error("Failed to fetch audit logs");
      return response.json();
    }
  });

  // Fetch audit statistics
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/audit-logs/stats", filters.startDate, filters.endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.startDate) params.set("startDate", filters.startDate.toISOString());
      if (filters.endDate) params.set("endDate", filters.endDate.toISOString());
      
      const response = await fetch(`/api/audit-logs/stats?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch audit statistics");
      return response.json();
    }
  });

  // Fetch users for filter dropdown
  const { data: usersData } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    }
  });

  // Cleanup mutation (admin only)
  const cleanupMutation = useMutation({
    mutationFn: async (daysToKeep: number) => {
      const response = await apiRequest("POST", "/api/audit-logs/cleanup", { daysToKeep });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Cleanup Complete",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-logs/stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Cleanup Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Filter audit logs based on search term
  const filteredLogs = useMemo(() => {
    if (!auditData?.logs || !filters.searchTerm) return auditData?.logs || [];
    
    const searchLower = filters.searchTerm.toLowerCase();
    return auditData.logs.filter((log: AuditLog) => {
      const userName = log.user?.name?.toLowerCase() || '';
      const userUsername = log.user?.username?.toLowerCase() || '';
      const action = log.action?.toLowerCase() || '';
      const entityType = log.entityType?.toLowerCase() || '';
      const entityTitle = log.entityTitle?.toLowerCase() || '';
      const ipAddress = log.ipAddress?.toLowerCase() || '';
      
      return userName.includes(searchLower) ||
             userUsername.includes(searchLower) ||
             action.includes(searchLower) ||
             entityType.includes(searchLower) ||
             entityTitle.includes(searchLower) ||
             ipAddress.includes(searchLower);
    });
  }, [auditData?.logs, filters.searchTerm]);

  // Helper function to get display value for Select components
  const getSelectValue = (filterValue: string) => {
    return filterValue === "" ? "all" : filterValue;
  };

  const resetFilters = () => {
    setFilters({
      userId: "",
      action: "",
      entityType: "",
      startDate: null,
      endDate: null,
      searchTerm: ""
    });
    setPagination({ offset: 0, limit: 50 });
  };

  const handleCleanup = async () => {
    if (window.confirm("Are you sure you want to clean up audit logs older than 90 days? This action cannot be undone.")) {
      cleanupMutation.mutate(90);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    
    // Format the date using facility timezone
    const facilityTimezone = getFacilityTimezone_Dynamic();
    
    return date.toLocaleString('en-US', {
      timeZone: facilityTimezone,
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const getActionBadge = (action: string) => {
    const colorClass = ACTION_COLORS[action as keyof typeof ACTION_COLORS] || "bg-gray-100 text-neutral-800";
    return (
      <Badge variant="secondary" className={colorClass}>
        {action}
      </Badge>
    );
  };

  const getEntityIcon = (entityType: string) => {
    const IconComponent = ENTITY_ICONS[entityType as keyof typeof ENTITY_ICONS] || Database;
    return <IconComponent className="h-4 w-4" />;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground">
            Track all system activities and user actions
          </p>
        </div>
        {user?.role === "admin" && (
          <Button
            onClick={handleCleanup}
            variant="outline"
            disabled={cleanupMutation.isPending}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Cleanup Old Logs
          </Button>
        )}
      </div>

      {/* Statistics Cards */}
      {statsData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.total.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Actions</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {statsData.byAction.slice(0, 3).map((stat, index) => (
                  <div key={stat.action} className="flex justify-between text-sm">
                    <span>{stat.action}</span>
                    <span className="font-medium">{stat.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Entities</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {statsData.byEntity.slice(0, 3).map((stat, index) => (
                  <div key={stat.entityType} className="flex justify-between text-sm">
                    <span className="capitalize">{stat.entityType}</span>
                    <span className="font-medium">{stat.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={filters.searchTerm}
                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                className="pl-10"
              />
            </div>

            {/* Action Filter */}
            <Select value={getSelectValue(filters.action)} onValueChange={(value) => setFilters({ ...filters, action: value === "all" ? "" : value })}>
              <SelectTrigger>
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="CREATE">Create</SelectItem>
                <SelectItem value="UPDATE">Update</SelectItem>
                <SelectItem value="DELETE">Delete</SelectItem>
                <SelectItem value="LOGIN">Login</SelectItem>
                <SelectItem value="LOGOUT">Logout</SelectItem>
                <SelectItem value="LOGIN_FAILED">Failed Login</SelectItem>
              </SelectContent>
            </Select>

            {/* Entity Type Filter */}
            <Select value={getSelectValue(filters.entityType)} onValueChange={(value) => setFilters({ ...filters, entityType: value === "all" ? "" : value })}>
              <SelectTrigger>
                <SelectValue placeholder="All Entities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                <SelectItem value="booking">Bookings</SelectItem>
                <SelectItem value="user">Users</SelectItem>
                <SelectItem value="alert">Alerts</SelectItem>
                <SelectItem value="template">Templates</SelectItem>
                <SelectItem value="authentication">Authentication</SelectItem>
                <SelectItem value="system_setting">System Settings</SelectItem>
              </SelectContent>
            </Select>

            {/* User Filter */}
            <Select value={getSelectValue(filters.userId)} onValueChange={(value) => setFilters({ ...filters, userId: value === "all" ? "" : value })}>
              <SelectTrigger>
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {usersData?.map((user: any) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name || user.username} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Start Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.startDate ? format(filters.startDate, "MMM dd, yyyy") : "Start Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.startDate}
                  onSelect={(date) => setFilters({ ...filters, startDate: date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* End Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.endDate ? format(filters.endDate, "MMM dd, yyyy") : "End Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.endDate}
                  onSelect={(date) => setFilters({ ...filters, endDate: date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Reset Button */}
            <Button onClick={resetFilters} variant="outline">
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Activity Log
          </CardTitle>
          <CardDescription>
            {auditData?.pagination?.total ? 
              `Showing ${filteredLogs?.length || 0} of ${auditData.pagination.total} entries` :
              "No audit logs found"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLogs?.length > 0 ? (
                <>
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-2">
                      {filteredLogs.map((log: AuditLog) => (
                        <div
                          key={log.id}
                          className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => setSelectedLog(log)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {getEntityIcon(log.entityType)}
                              <div>
                                <div className="flex items-center gap-2">
                                  {getActionBadge(log.action)}
                                  <span className="font-medium">{log.entityTitle || log.entityType}</span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  by {log.user?.name || 'System'} ({log.user?.username || 'N/A'}) • {formatTimestamp(log.timestamp)}
                                </div>
                              </div>
                            </div>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {/* Pagination */}
                  {auditData?.pagination && (
                    <div className="flex items-center justify-between pt-4">
                      <div className="text-sm text-muted-foreground">
                        Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, auditData.pagination.total)} of {auditData.pagination.total} entries
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPagination({ ...pagination, offset: Math.max(0, pagination.offset - pagination.limit) })}
                          disabled={pagination.offset === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPagination({ ...pagination, offset: pagination.offset + pagination.limit })}
                          disabled={!auditData.pagination.hasMore}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <Database className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No audit logs found</h3>
                  <p className="text-muted-foreground">
                    {Object.values(filters).some(f => f) ? 
                      "Try adjusting your filters to see more results." :
                      "No audit logs have been recorded yet."
                    }
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {getEntityIcon(selectedLog.entityType)}
                  Audit Log Details
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLog(null)}
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Action</label>
                      <div className="mt-1">{getActionBadge(selectedLog.action)}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Entity</label>
                      <div className="mt-1 capitalize">{selectedLog.entityType}</div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">User</label>
                    <div className="mt-1">
                      {selectedLog.user?.name || 'System'} ({selectedLog.user?.username || 'N/A'}) - {selectedLog.user?.role || 'System'}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Timestamp</label>
                    <div className="mt-1">{formatTimestamp(selectedLog.timestamp)}</div>
                  </div>

                  {selectedLog.entityTitle && (
                    <div>
                      <label className="text-sm font-medium">Entity Title</label>
                      <div className="mt-1">{selectedLog.entityTitle}</div>
                    </div>
                  )}

                  {selectedLog.ipAddress && (
                    <div>
                      <label className="text-sm font-medium">IP Address</label>
                      <div className="mt-1">{selectedLog.ipAddress}</div>
                    </div>
                  )}

                  {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                    <div>
                      <label className="text-sm font-medium">Details</label>
                      <div className="mt-1 bg-muted p-3 rounded-md">
                        <pre className="text-sm overflow-auto">
                          {JSON.stringify(selectedLog.details, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}