import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Studio } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import StudioManagementModal from "@/components/studio/StudioManagementModal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { FACILITY_TIMEZONE } from "@/lib/dateUtils";
import NotificationGroupsPanel from "@/components/settings/NotificationGroupsPanel";
import ProfilePanel from "@/components/settings/ProfilePanel";
import PcrRoomsPanel from "@/components/settings/PcrRoomsPanel";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
  const [selectedStudio, setSelectedStudio] = useState<Studio | undefined>(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [studioToDelete, setStudioToDelete] = useState<Studio | null>(null);
  
  // Fetch studios for studio settings
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });

  // Update studio status mutation
  const updateStudioStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/studios/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Studio status updated successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/studios"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update studio status",
        variant: "destructive",
      });
    },
  });

  // Toggle studio availability
  const toggleStudioAvailability = (studio: Studio) => {
    const newStatus = studio.status === "available" ? "maintenance" : "available";
    updateStudioStatus.mutate({ id: studio.id, status: newStatus });
  };
  
  // Delete studio mutation
  const deleteStudioMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/studios/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Studio deleted successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/studios"] });
      setIsDeleteDialogOpen(false);
      setStudioToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete studio. The studio might have active bookings.",
        variant: "destructive",
      });
      setIsDeleteDialogOpen(false);
    },
  });
  
  // Handle delete studio button click
  const handleDeleteStudio = (studio: Studio) => {
    setStudioToDelete(studio);
    setIsDeleteDialogOpen(true);
  };
  
  // Confirm delete studio
  const confirmDeleteStudio = () => {
    if (studioToDelete) {
      deleteStudioMutation.mutate(studioToDelete.id);
    }
  };

  // Format time options display
  const timeOptions = ["12-hour (AM/PM)", "24-hour"];
  const dateOptions = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];
  const firstDayOptions = ["Sunday", "Monday"];
  
  // No need to initialize timezone data - now using fixed facility timezone

  // For non-admin users, only show the Profile tab
  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col h-screen">
        <Header
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          view="week"
          onViewChange={() => {}}
          title="Settings"
        />
        <div className="container mx-auto p-4 pb-16">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">User Settings</h1>
            <p className="text-gray-500">Manage your profile and preferences</p>
          </div>
          
          <div className="max-w-2xl mx-auto">
            <ProfilePanel />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <Header
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        view="week"
        onViewChange={() => {}}
        title="Settings"
      />
      
      <div className="container mx-auto p-4 pb-16 overflow-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">System Settings</h1>
          <p className="text-gray-500">Configure application preferences and manage studio availability</p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="profile">My Profile</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="studios">Studios</TabsTrigger>
            <TabsTrigger value="pcr">PCR Rooms</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="backup">Backup & Restore</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile">
            <div className="max-w-2xl mx-auto">
              <ProfilePanel />
            </div>
          </TabsContent>
          
          <TabsContent value="general">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Date & Time Settings</CardTitle>
                  <CardDescription>Configure how dates and times are displayed</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label>Time Format</Label>
                      <div className="mt-2 space-y-2">
                        {timeOptions.map((option, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id={`time-${index}`}
                              name="timeFormat"
                              className="h-4 w-4 text-primary"
                              defaultChecked={index === 0}
                            />
                            <label htmlFor={`time-${index}`} className="text-sm">
                              {option}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <Label>Date Format</Label>
                      <div className="mt-2 space-y-2">
                        {dateOptions.map((option, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id={`date-${index}`}
                              name="dateFormat"
                              className="h-4 w-4 text-primary"
                              defaultChecked={index === 0}
                            />
                            <label htmlFor={`date-${index}`} className="text-sm">
                              {option}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <Label>First Day of Week</Label>
                      <div className="mt-2 space-y-2">
                        {firstDayOptions.map((option, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id={`day-${index}`}
                              name="firstDay"
                              className="h-4 w-4 text-primary"
                              defaultChecked={index === 0}
                            />
                            <label htmlFor={`day-${index}`} className="text-sm">
                              {option}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <Label>System Timezone</Label>
                      <div className="mt-2">
                        <p className="text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded">
                          <strong>America/Chicago</strong> (Dallas, TX - Central Time)
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          The system uses Chicago time for all bookings to ensure consistent scheduling
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <Button>Save Changes</Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Display Settings</CardTitle>
                  <CardDescription>Customize the application appearance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="dark-mode">Dark Mode</Label>
                      <Switch id="dark-mode" />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="compact-view">Compact View</Label>
                      <Switch id="compact-view" />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-weekends">Show Weekends</Label>
                      <Switch id="show-weekends" defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto-refresh">Auto-refresh (every 5 minutes)</Label>
                      <Switch id="auto-refresh" defaultChecked />
                    </div>
                  </div>
                  
                  <Button>Save Changes</Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="studios">
            <Card>
              <CardHeader>
                <CardTitle>Studio Management</CardTitle>
                <CardDescription>Set availability for studios</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">Studio</th>
                          <th className="text-left py-3 px-4 font-medium">Description</th>
                          <th className="text-left py-3 px-4 font-medium">Status</th>
                          <th className="text-left py-3 px-4 font-medium">Available</th>
                          <th className="text-left py-3 px-4 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studios.map(studio => (
                          <tr key={studio.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium">{studio.name}</td>
                            <td className="py-3 px-4">{studio.description || "No description"}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded text-xs ${
                                studio.status === "available" 
                                  ? "bg-green-100 text-green-800" 
                                  : studio.status === "maintenance"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-red-100 text-red-800"
                              }`}>
                                {studio.status.charAt(0).toUpperCase() + studio.status.slice(1)}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <Switch 
                                checked={studio.status === "available"}
                                onCheckedChange={() => toggleStudioAvailability(studio)}
                                disabled={updateStudioStatus.isPending}
                              />
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex space-x-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedStudio(studio);
                                    setIsStudioModalOpen(true);
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteStudio(studio)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <Button
                    onClick={() => {
                      setSelectedStudio(undefined);
                      setIsStudioModalOpen(true);
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Studio
                  </Button>
                  
                  {/* Studio Management Modal */}
                  <StudioManagementModal
                    isOpen={isStudioModalOpen}
                    onClose={() => setIsStudioModalOpen(false)}
                    studio={selectedStudio}
                  />
                  
                  {/* Delete Studio Confirmation Dialog */}
                  <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the studio
                          <strong>{studioToDelete ? ` "${studioToDelete.name}"` : ""}</strong> from the system.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteStudioMutation.isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={confirmDeleteStudio} 
                          disabled={deleteStudioMutation.isPending}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {deleteStudioMutation.isPending ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pcr">
            <PcrRoomsPanel />
          </TabsContent>
          
          <TabsContent value="notifications">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Settings</CardTitle>
                  <CardDescription>Configure email notifications and alerts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="email-notifications">Email Notifications</Label>
                      <Switch id="email-notifications" defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="sms-notifications">SMS Notifications</Label>
                      <Switch id="sms-notifications" />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="browser-notifications">Browser Notifications</Label>
                      <Switch id="browser-notifications" defaultChecked />
                    </div>
                    
                    <div className="pt-4 pb-2">
                      <h3 className="text-sm font-medium">Notification Events</h3>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="notify-new-booking">New Bookings</Label>
                      <Switch id="notify-new-booking" defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="notify-updates">Booking Updates</Label>
                      <Switch id="notify-updates" defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="notify-cancellations">Cancellations</Label>
                      <Switch id="notify-cancellations" defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="notify-reminders">Booking Reminders (24h before)</Label>
                      <Switch id="notify-reminders" defaultChecked />
                    </div>
                  </div>
                  
                  <Button>Save Notification Settings</Button>
                </CardContent>
              </Card>
              
              {/* Notification Groups Panel */}
              <NotificationGroupsPanel />
            </div>
          </TabsContent>
          
          <TabsContent value="backup">
            <Card>
              <CardHeader>
                <CardTitle>Backup & Restore</CardTitle>
                <CardDescription>Manage system data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Backup Data</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Create a backup of all system data including bookings, templates, and user information.
                    </p>
                    <Button>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      Create Backup
                    </Button>
                  </div>
                  
                  <div className="pt-4">
                    <h3 className="text-sm font-medium mb-2">Restore Data</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Restore system data from a previous backup file.
                    </p>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="17 8 12 3 7 8"></polyline>
                          <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        Select Backup File
                      </Button>
                      <Button variant="secondary" disabled>
                        Restore
                      </Button>
                    </div>
                  </div>
                  
                  <div className="pt-4">
                    <h3 className="text-sm font-medium mb-2 text-red-600">Danger Zone</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Permanently delete all system data. This action cannot be undone.
                    </p>
                    <Button variant="destructive">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                      Reset System Data
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
