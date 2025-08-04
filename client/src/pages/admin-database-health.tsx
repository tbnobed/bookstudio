import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Database, 
  Users, 
  Calendar, 
  Activity,
  HardDrive,
  Clock,
  TrendingUp,
  Shield,
  RefreshCw
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";

interface HealthMetrics {
  overall_status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  last_updated: string;
  data_integrity: {
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    orphaned_bookings: number;
    missing_users: number;
    invalid_dates: number;
    duplicate_records: number;
    referential_integrity_score: number;
  };
  performance: {
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    avg_query_time: number;
    slow_queries: number;
    connection_pool_usage: number;
    cache_hit_ratio: number;
    active_connections: number;
  };
  storage: {
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    database_size_mb: number;
    table_sizes: Array<{ table: string; size_mb: number; rows: number }>;
    growth_rate_mb_per_day: number;
    backup_status: 'SUCCESS' | 'FAILED' | 'PENDING';
    last_backup: string;
  };
  business_logic: {
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    booking_conflicts: number;
    resource_utilization: number;
    notification_delivery_rate: number;
    user_activity_score: number;
    system_uptime_hours: number;
  };
}

interface HealthIssue {
  id: string;
  category: 'DATA_INTEGRITY' | 'PERFORMANCE' | 'STORAGE' | 'BUSINESS_LOGIC';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  recommendation: string;
  detected_at: string;
  auto_fixable: boolean;
}

export default function AdminDatabaseHealth() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

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

  // Fetch health metrics
  const { data: healthMetrics, refetch: refetchHealth } = useQuery<HealthMetrics>({
    queryKey: ["/api/admin/database-health/metrics"],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch health issues
  const { data: healthIssues = [], refetch: refetchIssues } = useQuery<HealthIssue[]>({
    queryKey: ["/api/admin/database-health/issues"],
    refetchInterval: 30000,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchHealth(), refetchIssues()]);
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY': return 'bg-green-100 text-green-800';
      case 'WARNING': return 'bg-yellow-100 text-yellow-800';
      case 'CRITICAL': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'WARNING': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'CRITICAL': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'LOW': return 'bg-blue-100 text-blue-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'CRITICAL': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const criticalIssues = healthIssues.filter(issue => issue.severity === 'CRITICAL');
  const highIssues = healthIssues.filter(issue => issue.severity === 'HIGH');
  const autoFixableIssues = healthIssues.filter(issue => issue.auto_fixable);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Database Health Monitor</h1>
          <p className="text-muted-foreground">
            Comprehensive system health and data integrity monitoring
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Overall Health Status */}
      {healthMetrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(healthMetrics.overall_status)}
              System Health Overview
            </CardTitle>
            <CardDescription>
              Last updated: {format(new Date(healthMetrics.last_updated), "MMM d, yyyy 'at' h:mm a")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <Badge className={getStatusColor(healthMetrics.data_integrity.status)}>
                  Data Integrity
                </Badge>
                <div className="text-sm text-muted-foreground mt-1">
                  {healthMetrics.data_integrity.referential_integrity_score}% Score
                </div>
              </div>
              <div className="text-center">
                <Badge className={getStatusColor(healthMetrics.performance.status)}>
                  Performance
                </Badge>
                <div className="text-sm text-muted-foreground mt-1">
                  {healthMetrics.performance.avg_query_time}ms Avg
                </div>
              </div>
              <div className="text-center">
                <Badge className={getStatusColor(healthMetrics.storage.status)}>
                  Storage
                </Badge>
                <div className="text-sm text-muted-foreground mt-1">
                  {healthMetrics.storage.database_size_mb}MB Used
                </div>
              </div>
              <div className="text-center">
                <Badge className={getStatusColor(healthMetrics.business_logic.status)}>
                  Business Logic
                </Badge>
                <div className="text-sm text-muted-foreground mt-1">
                  {healthMetrics.business_logic.resource_utilization}% Utilization
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Critical Issues Alert */}
      {criticalIssues.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Critical Issues Detected:</strong> {criticalIssues.length} critical issue(s) require immediate attention.
            {autoFixableIssues.length > 0 && (
              <span> {autoFixableIssues.length} issue(s) can be automatically fixed.</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="data-integrity">Data Integrity</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="issues">Issues ({healthIssues.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {healthMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{healthMetrics.performance.active_connections}</div>
                  <p className="text-xs text-muted-foreground">Currently connected</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{Math.round(healthMetrics.business_logic.system_uptime_hours)}h</div>
                  <p className="text-xs text-muted-foreground">Continuous operation</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Booking Conflicts</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{healthMetrics.business_logic.booking_conflicts}</div>
                  <p className="text-xs text-muted-foreground">Require resolution</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="data-integrity" className="space-y-4">
          {healthMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Data Quality Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Referential Integrity</span>
                    <div className="flex items-center gap-2">
                      <Progress value={healthMetrics.data_integrity.referential_integrity_score} className="w-20" />
                      <span className="text-sm font-medium">{healthMetrics.data_integrity.referential_integrity_score}%</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Orphaned Bookings</span>
                      <Badge variant={healthMetrics.data_integrity.orphaned_bookings > 0 ? "destructive" : "secondary"}>
                        {healthMetrics.data_integrity.orphaned_bookings}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Missing Users</span>
                      <Badge variant={healthMetrics.data_integrity.missing_users > 0 ? "destructive" : "secondary"}>
                        {healthMetrics.data_integrity.missing_users}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Invalid Dates</span>
                      <Badge variant={healthMetrics.data_integrity.invalid_dates > 0 ? "destructive" : "secondary"}>
                        {healthMetrics.data_integrity.invalid_dates}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Duplicate Records</span>
                      <Badge variant={healthMetrics.data_integrity.duplicate_records > 0 ? "destructive" : "secondary"}>
                        {healthMetrics.data_integrity.duplicate_records}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Data Integrity Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-4">
                    {getStatusIcon(healthMetrics.data_integrity.status)}
                    <Badge className={getStatusColor(healthMetrics.data_integrity.status)}>
                      {healthMetrics.data_integrity.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {healthMetrics.data_integrity.status === 'HEALTHY' 
                      ? "All data integrity checks are passing. Your database is in excellent health."
                      : healthMetrics.data_integrity.status === 'WARNING'
                      ? "Some data integrity issues detected. Review and address the identified problems."
                      : "Critical data integrity issues found. Immediate action required to prevent data corruption."
                    }
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          {healthMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Query Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Average Query Time</span>
                    <Badge variant={healthMetrics.performance.avg_query_time > 1000 ? "destructive" : 
                                   healthMetrics.performance.avg_query_time > 500 ? "secondary" : "default"}>
                      {healthMetrics.performance.avg_query_time}ms
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span>Cache Hit Ratio</span>
                    <div className="flex items-center gap-2">
                      <Progress value={healthMetrics.performance.cache_hit_ratio} className="w-20" />
                      <span className="text-sm font-medium">{healthMetrics.performance.cache_hit_ratio}%</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span>Connection Pool Usage</span>
                    <div className="flex items-center gap-2">
                      <Progress value={healthMetrics.performance.connection_pool_usage} className="w-20" />
                      <span className="text-sm font-medium">{healthMetrics.performance.connection_pool_usage}%</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm">Slow Queries</span>
                    <Badge variant={healthMetrics.performance.slow_queries > 5 ? "destructive" : "secondary"}>
                      {healthMetrics.performance.slow_queries}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Connection Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(healthMetrics.performance.status)}
                      <Badge className={getStatusColor(healthMetrics.performance.status)}>
                        {healthMetrics.performance.status}
                      </Badge>
                    </div>
                    
                    <div className="text-2xl font-bold">{healthMetrics.performance.active_connections}</div>
                    <p className="text-sm text-muted-foreground">Active database connections</p>
                    
                    <div className="text-sm space-y-1">
                      <div>Pool Utilization: {healthMetrics.performance.connection_pool_usage}%</div>
                      <div>Query Performance: {healthMetrics.performance.avg_query_time}ms avg</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="storage" className="space-y-4">
          {healthMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5" />
                    Storage Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{healthMetrics.storage.database_size_mb}</div>
                    <div className="text-sm text-muted-foreground">MB Total Size</div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span>Growth Rate</span>
                    <Badge variant={healthMetrics.storage.growth_rate_mb_per_day > 100 ? "secondary" : "default"}>
                      +{healthMetrics.storage.growth_rate_mb_per_day} MB/day
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span>Backup Status</span>
                    <Badge variant={healthMetrics.storage.backup_status === 'SUCCESS' ? "default" : 
                                   healthMetrics.storage.backup_status === 'PENDING' ? "secondary" : "destructive"}>
                      {healthMetrics.storage.backup_status}
                    </Badge>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    Last backup: {healthMetrics.storage.last_backup ? 
                      format(new Date(healthMetrics.storage.last_backup), "MMM d, yyyy 'at' h:mm a") : 
                      "Never"
                    }
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Table Sizes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {healthMetrics.storage.table_sizes.map((table) => (
                      <div key={table.table} className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{table.table}</div>
                          <div className="text-xs text-muted-foreground">{table.rows.toLocaleString()} rows</div>
                        </div>
                        <Badge variant="outline">{table.size_mb} MB</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {healthIssues.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Issues Detected</h3>
                  <p className="text-muted-foreground">Your database is healthy and all systems are operating normally.</p>
                </CardContent>
              </Card>
            ) : (
              healthIssues.map((issue) => (
                <Card key={issue.id} className={
                  issue.severity === 'CRITICAL' ? 'border-red-200' :
                  issue.severity === 'HIGH' ? 'border-orange-200' : ''
                }>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{issue.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge className={getSeverityColor(issue.severity)}>
                          {issue.severity}
                        </Badge>
                        {issue.auto_fixable && (
                          <Badge variant="outline" className="text-blue-600">
                            Auto-fixable
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription>
                      {issue.category.replace('_', ' ')} • Detected {format(new Date(issue.detected_at), "MMM d 'at' h:mm a")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-3">{issue.description}</p>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Recommendation:</strong> {issue.recommendation}
                      </p>
                    </div>
                    {issue.auto_fixable && (
                      <div className="mt-3">
                        <Button size="sm" variant="outline">
                          Auto-Fix Issue
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}