import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Download, Clock, Database, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BackupStatus {
  lastBackup: string | null;
  lastBackupSize: number | null;
  lastBackupStatus: 'success' | 'failed' | 'in_progress';
  nextScheduledBackup: string | null;
  totalBackups: number;
  config: {
    enabled: boolean;
    schedule: string;
    retentionDays: number;
    backupPath: string;
  };
}

interface BackupFile {
  filename: string;
  size: number;
  date: string;
}

export default function BackupPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

  // Fetch backup status
  const { data: backupStatus, isLoading: statusLoading } = useQuery<BackupStatus>({
    queryKey: ["/api/backup/status"],
    refetchInterval: 5000, // Refresh every 5 seconds to show live status
  });

  // Fetch backup list
  const { data: backups = [], isLoading: backupsLoading } = useQuery<BackupFile[]>({
    queryKey: ["/api/backup/list"],
  });

  // Create backup mutation
  const createBackupMutation = useMutation({
    mutationFn: async () => {
      setIsCreatingBackup(true);
      const response = await apiRequest("POST", "/api/backup/create");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Backup Created",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/backup/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/backup/list"] });
    },
    onError: (error: any) => {
      toast({
        title: "Backup Failed",
        description: error.message || "Failed to create backup",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsCreatingBackup(false);
    },
  });

  // Restore backup mutation
  const restoreBackupMutation = useMutation({
    mutationFn: async (filename: string) => {
      const response = await apiRequest("POST", `/api/backup/restore/${filename}`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Restore Complete",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Restore Failed",
        description: error.message || "Failed to restore backup",
        variant: "destructive",
      });
    },
  });

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const facilityTimezone = import.meta.env.VITE_FACILITY_TIMEZONE || 'America/Chicago';
    return new Date(dateString).toLocaleString('en-US', {
      timeZone: facilityTimezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />Success</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800"><Loader2 className="w-3 h-3 mr-1 animate-spin" />In Progress</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (statusLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Backup & Restore</CardTitle>
          <CardDescription>Automated database backup system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Backup Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Backup & Restore</CardTitle>
          <CardDescription>Automated database backup system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Overview */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-3">System Status</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Backup System</span>
                    <Badge className="bg-green-100 text-green-800">
                      {backupStatus?.config.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Last Backup Status</span>
                    {backupStatus && getStatusBadge(backupStatus.lastBackupStatus)}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Backups</span>
                    <span className="text-sm font-medium">{backupStatus?.totalBackups || 0}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-3">Schedule</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Frequency</span>
                    <span className="text-sm">Daily at 2:00 AM</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Retention</span>
                    <span className="text-sm">{backupStatus?.config.retentionDays || 30} days</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Next Backup</span>
                    <span className="text-sm">
                      {backupStatus?.nextScheduledBackup 
                        ? formatDate(backupStatus.nextScheduledBackup)
                        : 'Not scheduled'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Latest Backup Info */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-3">Latest Backup</h3>
                {backupStatus?.lastBackup ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Date</span>
                      <span className="text-sm">{formatDate(backupStatus.lastBackup)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Size</span>
                      <span className="text-sm">
                        {backupStatus.lastBackupSize ? formatFileSize(backupStatus.lastBackupSize) : 'Unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Status</span>
                      {getStatusBadge(backupStatus.lastBackupStatus)}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Database className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No backups yet</p>
                  </div>
                )}
              </div>

              <div className="pt-4">
                <Button
                  onClick={() => createBackupMutation.mutate()}
                  disabled={createBackupMutation.isPending || isCreatingBackup || backupStatus?.lastBackupStatus === 'in_progress'}
                  className="w-full"
                >
                  {(createBackupMutation.isPending || isCreatingBackup || backupStatus?.lastBackupStatus === 'in_progress') ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Backup...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Create Backup Now
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backup History Card */}
      <Card>
        <CardHeader>
          <CardTitle>Backup History</CardTitle>
          <CardDescription>View and manage existing backups</CardDescription>
        </CardHeader>
        <CardContent>
          {backupsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No backup files found</p>
              <p className="text-sm text-gray-400 mt-1">Create your first backup to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((backup, index) => (
                <div
                  key={backup.filename}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-3">
                    <Database className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium">{backup.filename}</p>
                      <div className="flex items-center text-xs text-gray-500 space-x-3">
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDate(backup.date)}
                        </span>
                        <span>{formatFileSize(backup.size)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Are you sure you want to restore from "${backup.filename}"? This will replace all current data.`)) {
                          restoreBackupMutation.mutate(backup.filename);
                        }
                      }}
                      disabled={restoreBackupMutation.isPending}
                    >
                      {restoreBackupMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        'Restore'
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
            Important Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <p>
              <strong>Automatic Backups:</strong> The system creates daily backups at 2:00 AM automatically.
            </p>
            <p>
              <strong>Retention Policy:</strong> Backups are kept for {backupStatus?.config.retentionDays || 30} days, after which older backups are automatically removed.
            </p>
            <p>
              <strong>Restore Warning:</strong> Restoring a backup will replace all current data. Make sure to create a current backup before restoring an older one.
            </p>
            <p>
              <strong>System Downtime:</strong> The system may experience brief downtime during backup creation and restore operations.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}