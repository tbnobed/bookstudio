import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Studio } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import StudioManagementModal from "@/components/studio/StudioManagementModal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { FACILITY_TIMEZONE } from "@/lib/dateUtils";
import { setFacilityTimezoneAsync, clearFacilityTimezoneAsync, getFacilityTimezoneAsync } from "@/lib/timezoneConfig";
import NotificationGroupsPanel from "@/components/settings/NotificationGroupsPanel";
import ProfilePanel from "@/components/settings/ProfilePanel";
import PcrRoomsPanel from "@/components/settings/PcrRoomsPanel";
import BackupPanel from "@/components/BackupPanel";

// Function to format timezone display
function formatTimezoneDisplay(timezone: string): { displayName: string; description: string } {
  const timezoneMap: Record<string, { displayName: string; description: string }> = {
    'America/Chicago': { 
      displayName: 'America/Chicago',
      description: 'Dallas, TX - Central Time'
    },
    'America/Los_Angeles': { 
      displayName: 'America/Los_Angeles',
      description: 'Los Angeles, CA - Pacific Time'
    },
    'America/New_York': { 
      displayName: 'America/New_York',
      description: 'New York, NY - Eastern Time'
    },
    'America/Denver': { 
      displayName: 'America/Denver',
      description: 'Denver, CO - Mountain Time'
    }
  };
  
  return timezoneMap[timezone] || { 
    displayName: timezone,
    description: timezone.replace('_', ' ')
  };
}

// Site Name Form Component
function SiteNameForm() {
  const { siteName, updateSiteName, isUpdating } = useSiteSettings();
  
  // Set up form validation schema
  const formSchema = z.object({
    siteName: z.string()
      .min(2, { message: "Site name must be at least 2 characters" })
      .max(50, { message: "Site name must be less than 50 characters" })
  });
  
  // Form initialization
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      siteName: siteName || "BookStud.io"
    }
  });
  
  // Update form default values when siteName is loaded
  useEffect(() => {
    if (siteName) {
      form.reset({ siteName });
    }
  }, [siteName, form]);
  
  // Form submission handler
  function onSubmit(values: z.infer<typeof formSchema>) {
    updateSiteName(values.siteName);
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="siteName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Site Name</FormLabel>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input placeholder="Enter site name" {...field} />
                </FormControl>
                <Button type="submit" disabled={isUpdating} className="flex-shrink-0">
                  {isUpdating ? "Updating..." : "Save"}
                </Button>
              </div>
              <FormDescription className="text-xs mt-1">
                Displayed in the sidebar and browser title
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
  const [selectedStudio, setSelectedStudio] = useState<Studio | undefined>(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [studioToDelete, setStudioToDelete] = useState<Studio | null>(null);
  const [currentTimezone, setCurrentTimezone] = useState<string>(FACILITY_TIMEZONE);
  
  // Load current effective timezone on component mount
  useEffect(() => {
    const loadCurrentTimezone = async () => {
      try {
        const effectiveTimezone = await getFacilityTimezoneAsync();
        setCurrentTimezone(effectiveTimezone);
      } catch (error) {
        console.error('Failed to load current timezone:', error);
      }
    };
    loadCurrentTimezone();
  }, []);
  
  // Enhanced timezone setter that updates both database and local state
  const handleSetTimezone = async (timezone: string) => {
    try {
      await setFacilityTimezoneAsync(timezone);
      setCurrentTimezone(timezone);
      toast({
        title: "Timezone Updated",
        description: `System timezone set to ${formatTimezoneDisplay(timezone).description}`,
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update timezone setting",
        variant: "destructive",
      });
    }
  };
  
  // Enhanced timezone clearer that updates both database and local state
  const handleClearTimezone = async () => {
    try {
      await clearFacilityTimezoneAsync();
      setCurrentTimezone(FACILITY_TIMEZONE);
      toast({
        title: "Timezone Cleared",
        description: `System timezone reset to build-time value: ${formatTimezoneDisplay(FACILITY_TIMEZONE).description}`,
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear timezone setting",
        variant: "destructive",
      });
    }
  };
  
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

  // For regular users (not admins or site managers), only show the Profile tab
  if (user?.role !== "admin" && user?.role !== "site_manager") {
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
        showViewToggle={false}
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
              <div className="md:col-span-1 flex flex-col gap-6">
                <Card className="h-fit">
                  <CardHeader>
                    <CardTitle>Site Settings</CardTitle>
                    <CardDescription>Configure basic site information</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-8">
                    <SiteNameForm />
                    <div className="mt-8 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        This name appears throughout the application and in browser window titles.
                      </p>
                    </div>
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
                        <Label htmlFor="show-weekends">Show Weekends in Calendar</Label>
                        <Switch id="show-weekends" defaultChecked />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="auto-refresh">Auto-refresh Calendar (every 5 minutes)</Label>
                        <Switch id="auto-refresh" defaultChecked />
                      </div>
                    </div>
                    
                    <div className="pt-2 text-sm text-muted-foreground">
                      <p>Additional customization options will be available in future updates.</p>
                    </div>
                    
                    <Button>Save Changes</Button>
                  </CardContent>
                </Card>
              </div>
              
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
                          <strong>{formatTimezoneDisplay(currentTimezone).displayName}</strong> ({formatTimezoneDisplay(currentTimezone).description})
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          The system uses {formatTimezoneDisplay(currentTimezone).displayName} for all bookings to ensure consistent scheduling
                        </p>
                        <p className="text-xs text-red-600 mt-2 font-mono bg-red-50 p-2 rounded border border-red-200">
                          DEBUG: Build-time Variable = {FACILITY_TIMEZONE}, Current Effective = {currentTimezone}
                        </p>
                        <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
                          <h4 className="text-sm font-medium mb-2">Timezone Override Control</h4>
                          <p className="text-xs text-gray-600 mb-3">
                            Use this to override the timezone without rebuilding the application:
                          </p>
                          <div className="space-y-2">
                            <button 
                              onClick={() => handleSetTimezone('America/Los_Angeles')}
                              className="w-full text-left px-3 py-2 text-sm bg-white border rounded hover:bg-gray-50"
                            >
                              Set to Los Angeles (America/Los_Angeles)
                            </button>
                            <button 
                              onClick={() => handleSetTimezone('America/Chicago')}
                              className="w-full text-left px-3 py-2 text-sm bg-white border rounded hover:bg-gray-50"
                            >
                              Set to Dallas (America/Chicago)
                            </button>
                            <button 
                              onClick={() => handleSetTimezone('America/New_York')}
                              className="w-full text-left px-3 py-2 text-sm bg-white border rounded hover:bg-gray-50"
                            >
                              Set to New York (America/New_York)
                            </button>
                            <button 
                              onClick={() => handleSetTimezone('America/Denver')}
                              className="w-full text-left px-3 py-2 text-sm bg-white border rounded hover:bg-gray-50"
                            >
                              Set to Denver (America/Denver)
                            </button>
                            <button 
                              onClick={() => handleClearTimezone()}
                              className="w-full text-left px-3 py-2 text-sm bg-red-50 border border-red-200 rounded hover:bg-red-100 text-red-700"
                            >
                              Clear Override (use build-time value)
                            </button>
                          </div>
                        </div>
                      </div>
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
                  </div>
                  
                  <div className="pt-2 text-sm text-muted-foreground">
                    <p>Email notifications are sent to users and notification groups based on booking operations.</p>
                    <p className="mt-2">Browser and SMS notifications will be available in future updates.</p>
                  </div>
                  
                  <Button>Save Notification Settings</Button>
                </CardContent>
              </Card>
              
              {/* Notification Groups Panel */}
              <NotificationGroupsPanel />
            </div>
          </TabsContent>
          
          <TabsContent value="backup">
            <BackupPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
