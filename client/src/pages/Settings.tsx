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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTimezone, COMMON_TIMEZONES, DEFAULT_TIMEZONE } from "@/contexts/TimezoneContext";
import NotificationGroupsPanel from "@/components/settings/NotificationGroupsPanel";
import ProfilePanel from "@/components/settings/ProfilePanel";
import PcrRoomsPanel from "@/components/settings/PcrRoomsPanel";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { timezone, setTimezone } = useTimezone();
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
  
  // When the component loads, log the current timezone
  useEffect(() => {
    console.log("TimezoneContext in Settings - Current timezone:", timezone);
    console.log("TimezoneContext in Settings - Available timezones:", COMMON_TIMEZONES);
  }, [timezone]);

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
                      <Label htmlFor="timezone-select">Timezone</Label>
                      <div className="mt-2">
                        <Select
                          value={timezone}
                          onValueChange={(value) => setTimezone(value)}
                        >
                          <SelectTrigger id="timezone-select" className="w-full">
                            <SelectValue placeholder="Select a timezone" />
                          </SelectTrigger>
                          <SelectContent>
                            {COMMON_TIMEZONES.map((tz) => (
                              <SelectItem key={tz} value={tz}>
                                {tz.replace("_", " ").replace(/\//g, " / ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Current timezone: {timezone || DEFAULT_TIMEZONE} ({new Date().toLocaleString('en-US', { timeZone: timezone })})
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <Button onClick={() => {
                    toast({
                      title: "Timezone saved",
                      description: `Application will now use ${timezone} for all date and time operations`,
                    });
                  }}>
                    Save Changes
                  </Button>
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
                    Add Studio
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {isStudioModalOpen && (
              <StudioManagementModal
                isOpen={isStudioModalOpen}
                onClose={() => setIsStudioModalOpen(false)}
                studio={selectedStudio}
              />
            )}
            
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the studio "{studioToDelete?.name}". This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDeleteStudio} className="bg-red-600 hover:bg-red-700">
                    Delete Studio
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>
          
          <TabsContent value="pcr">
            <PcrRoomsPanel />
          </TabsContent>
          
          <TabsContent value="notifications">
            <NotificationGroupsPanel />
          </TabsContent>
          
          <TabsContent value="backup">
            <Card>
              <CardHeader>
                <CardTitle>Backup & Restore</CardTitle>
                <CardDescription>Manage your data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium">Export Data</h3>
                    <p className="text-sm text-gray-500 mt-1">Download a backup of your current data</p>
                    <div className="mt-4 space-x-2">
                      <Button variant="outline">Export Studio Settings</Button>
                      <Button variant="outline">Export Bookings</Button>
                      <Button variant="outline">Export Everything</Button>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <h3 className="text-lg font-medium">Import Data</h3>
                    <p className="text-sm text-gray-500 mt-1">Restore from a previous backup</p>
                    <div className="mt-4">
                      <Button variant="outline">Select Backup File</Button>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <h3 className="text-lg font-medium text-red-600">Danger Zone</h3>
                    <p className="text-sm text-gray-500 mt-1">These actions cannot be undone</p>
                    <div className="mt-4 space-x-2">
                      <Button variant="destructive">Reset All Settings</Button>
                      <Button variant="destructive">Clear All Bookings</Button>
                    </div>
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