import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Studio } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import StudioManagementModal from "@/components/studio/StudioManagementModal";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  
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

  // Format time options display
  const timeOptions = ["12-hour (AM/PM)", "24-hour"];
  const dateOptions = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];
  const firstDayOptions = ["Sunday", "Monday"];

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
                You don't have permission to access the Settings page. Only administrators can change system settings.
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
        view="week"
        onViewChange={() => {}}
        title="Settings"
      />
      
      <div className="container mx-auto p-4 pb-16 overflow-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">System Settings</h1>
          <p className="text-gray-500">Configure application preferences and manage studio availability</p>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="studios">Studios</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="backup">Backup & Restore</TabsTrigger>
          </TabsList>
          
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
                              <Button variant="outline" size="sm">Edit</Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <Button>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Studio
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="notifications">
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
