import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, Mail, Users, Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { NotificationGroup } from "@shared/schema";

// Form schema for notification groups
const notificationGroupSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  groupType: z.string().min(1, { message: "Please select a group type" }),
  description: z.string().optional(),
  enabled: z.boolean().default(true)
});

type NotificationGroupFormValues = z.infer<typeof notificationGroupSchema>;

// Dialog component for creating/editing notification groups
const NotificationGroupDialog: React.FC<{
  group?: NotificationGroup;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: NotificationGroupFormValues) => void;
  isSubmitting: boolean;
}> = ({ group, isOpen, onOpenChange, onSubmit, isSubmitting }) => {
  const form = useForm<NotificationGroupFormValues>({
    resolver: zodResolver(notificationGroupSchema),
    defaultValues: {
      name: "",
      email: "",
      groupType: "department",
      description: "",
      enabled: true
    }
  });

  // Reset form when group changes or dialog opens
  useEffect(() => {
    if (isOpen) {
      if (group) {
        console.log("Resetting form with group data:", group);
        form.reset({
          name: group.name,
          email: group.email,
          groupType: group.groupType,
          description: group.description || "",
          enabled: group.enabled !== null ? group.enabled : true
        });
      } else {
        console.log("Resetting form for new group");
        form.reset({
          name: "",
          email: "",
          groupType: "department",
          description: "",
          enabled: true
        });
      }
    }
  }, [group, isOpen, form]);

  const handleSubmit = (data: NotificationGroupFormValues) => {
    console.log("Submitting notification group form data:", data);
    onSubmit(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {group ? "Edit Notification Group" : "Create Notification Group"}
          </DialogTitle>
          <DialogDescription>
            {group
              ? "Update the notification group details"
              : "Create a new notification group for email distributions"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Camera Operators" {...field} />
                  </FormControl>
                  <FormDescription>
                    The display name for this notification group
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., camera-team@studios.com" {...field} />
                  </FormControl>
                  <FormDescription>
                    The email address for this distribution group
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="groupType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a group type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="department">Department</SelectItem>
                      <SelectItem value="facility">Facility-wide</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The type of notification group
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the purpose of this notification group"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional description for this notification group
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Enabled</FormLabel>
                    <FormDescription>
                      Whether this notification group is currently active
                    </FormDescription>
                  </div>
                  <FormControl>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {group ? "Update Group" : "Create Group"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const NotificationGroupsPanel: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<NotificationGroup | undefined>(undefined);
  const [localGroups, setLocalGroups] = useState<NotificationGroup[]>([]);

  // Fetch notification groups
  const {
    data: groups = [] as NotificationGroup[],
    isLoading,
    error,
    refetch
  } = useQuery<NotificationGroup[]>({
    queryKey: ["/api/notification-groups"],
    retry: 1,
    refetchInterval: 5000, // Refresh data every 5 seconds
    staleTime: 2000 // Data becomes stale after 2 seconds
  });

  // Update local state when data changes from server
  useEffect(() => {
    if (groups) {
      console.log("Notification groups updated from server:", groups);
      setLocalGroups(groups);
    }
  }, [groups]);

  // Force refresh function
  const forceRefresh = () => {
    console.log("Forcing refresh of notification groups");
    refetch();
  };

  // Create notification group mutation
  const createMutation = useMutation({
    mutationFn: async (data: NotificationGroupFormValues) => {
      const res = await apiRequest("POST", "/api/notification-groups", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-groups"] });
      setIsDialogOpen(false);
      forceRefresh();
      toast({
        title: "Success",
        description: "Notification group created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to create notification group: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Update notification group mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: NotificationGroupFormValues;
    }) => {
      const res = await apiRequest("PATCH", `/api/notification-groups/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-groups"] });
      setIsDialogOpen(false);
      setSelectedGroup(undefined);
      forceRefresh();
      toast({
        title: "Success",
        description: "Notification group updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update notification group: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete notification group mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      try {
        const response = await apiRequest("DELETE", `/api/notification-groups/${id}`);
        
        // Check if response is not ok (e.g., 404 Not Found)
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP error ${response.status}`);
        }
        
        return response;
      } catch (error) {
        console.error("Delete notification group error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-groups"] });
      forceRefresh();
      toast({
        title: "Success",
        description: "Notification group deleted successfully",
      });
    },
    onError: (error: Error) => {
      // If the error is about a non-existent group, we still want to refresh the UI
      if (error.message.includes("not found")) {
        console.log("Group not found, forcing refresh");
        queryClient.invalidateQueries({ queryKey: ["/api/notification-groups"] });
        forceRefresh();
        
        // Show a toast that's more informative but not an error
        toast({
          title: "Information",
          description: "The notification group was already deleted or doesn't exist.",
        });
        return;
      }
      
      // For other errors
      toast({
        title: "Error",
        description: `Failed to delete notification group: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleOpenCreateDialog = () => {
    setSelectedGroup(undefined);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (group: NotificationGroup) => {
    setSelectedGroup(group);
    setIsDialogOpen(true);
  };

  const handleDialogSubmit = (data: NotificationGroupFormValues) => {
    if (selectedGroup) {
      updateMutation.mutate({ id: selectedGroup.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDeleteGroup = (id: number) => {
    if (confirm("Are you sure you want to delete this notification group?")) {
      deleteMutation.mutate(id);
    }
  };

  // Get type badge color
  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "department":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "facility":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "custom":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Notification Groups</CardTitle>
          <CardDescription>
            Manage email distribution groups for notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-6 text-red-600">
            Error loading notification groups. Please try again later.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Notification Groups</CardTitle>
          <CardDescription>
            Manage email distribution groups for notifications
          </CardDescription>
        </div>
        <Button onClick={handleOpenCreateDialog}>
          <Plus className="mr-2 h-4 w-4" /> Add Group
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
            <Users className="h-8 w-8" />
            <p>No notification groups found</p>
            <Button variant="outline" size="sm" onClick={handleOpenCreateDialog}>
              <Plus className="mr-2 h-4 w-4" /> Create your first group
            </Button>
          </div>
        ) : (
          <Table>
            <TableCaption>A list of notification groups for email distributions.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group: NotificationGroup) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{group.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{group.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getTypeBadgeColor(group.groupType)}>
                      <Tag className="mr-1 h-3 w-3" />
                      {group.groupType.charAt(0).toUpperCase() + group.groupType.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={group.enabled ? "default" : "secondary"}>
                      {group.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEditDialog(group)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteGroup(group.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <NotificationGroupDialog
        group={selectedGroup}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={handleDialogSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    </Card>
  );
};

export default NotificationGroupsPanel;