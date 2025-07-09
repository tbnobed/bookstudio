import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import type { Template, InsertTemplate, Studio, PcrRoom, NotificationGroup, BookingType } from "@shared/schema";

interface TemplateFormProps {
  isOpen: boolean;
  onClose: () => void;
  template?: Template | null;
}

export function TemplateForm({ isOpen, onClose, template }: TemplateFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("production");
  const [duration, setDuration] = useState("60");
  const [selectedStudioIds, setSelectedStudioIds] = useState<number[]>([]);
  const [pcrRoomId, setPcrRoomId] = useState<number | null>(null);
  const [status, setStatus] = useState("confirmed");
  const [color, setColor] = useState("#3b82f6");
  const [selectedNotifyGroups, setSelectedNotifyGroups] = useState<number[]>([]);

  // Fetch data for form options
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });

  const { data: pcrRooms = [] } = useQuery<PcrRoom[]>({
    queryKey: ["/api/pcr-rooms"],
  });

  const { data: notificationGroups = [] } = useQuery<NotificationGroup[]>({
    queryKey: ["/api/notification-groups"],
  });

  const { data: bookingTypes = [] } = useQuery<BookingType[]>({
    queryKey: ["/api/booking-types"],
  });

  // Set initial form values when editing
  useEffect(() => {
    if (template) {
      setName(template.name || "");
      setDescription(template.description || "");
      setType(template.type || "production");
      setDuration((template.duration || 60).toString());
      
      // Parse studio IDs from JSON
      const studioIds = Array.isArray(template.studioIds) ? template.studioIds : [];
      setSelectedStudioIds(studioIds);
      
      setPcrRoomId(template.pcrRoomId || null);
      setStatus(template.status || "confirmed");
      setColor(template.color || "#3b82f6");
      
      // Parse notification groups from JSON
      const notifyGroups = Array.isArray(template.notifyList) ? template.notifyList : [];
      setSelectedNotifyGroups(notifyGroups);
    } else {
      // Reset form when creating a new template
      setName("");
      setDescription("");
      setType("production");
      setDuration("60");
      setSelectedStudioIds([]);
      setPcrRoomId(null);
      setStatus("confirmed");
      setColor("#3b82f6");
      setSelectedNotifyGroups([]);
    }
  }, [template, isOpen]);

  // Create template mutation
  const createTemplate = useMutation({
    mutationFn: async (templateData: InsertTemplate) => {
      const res = await apiRequest("POST", "/api/templates", templateData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template created",
        description: "Your booking template has been created successfully.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update template mutation
  const updateTemplate = useMutation({
    mutationFn: async (templateData: Partial<Template>) => {
      const res = await apiRequest("PATCH", `/api/templates/${template?.id}`, templateData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template updated",
        description: "Your booking template has been updated successfully.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete template mutation
  const deleteTemplate = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/templates/${template?.id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template deleted",
        description: "The template has been deleted successfully.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    const templateData = {
      name,
      description: description || null,
      type,
      duration: parseInt(duration),
      studioIds: selectedStudioIds,
      pcrRoomId,
      status,
      color,
      notifyList: selectedNotifyGroups,
      createdBy: user.id,
    };

    if (template) {
      updateTemplate.mutate(templateData);
    } else {
      createTemplate.mutate(templateData);
    }
  };

  const handleStudioToggle = (studioId: number) => {
    setSelectedStudioIds(prev => 
      prev.includes(studioId) 
        ? prev.filter(id => id !== studioId)
        : [...prev, studioId]
    );
  };

  const handleNotifyGroupToggle = (groupId: number) => {
    setSelectedNotifyGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const isLoading = createTemplate.isPending || updateTemplate.isPending || deleteTemplate.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? "Edit Template" : "Create Template"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter template name"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="template-type">Template Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {bookingTypes
                      .filter(type => type.isActive)
                      .map(type => (
                        <SelectItem key={type.id} value={type.name.toLowerCase()}>
                          {type.name}
                        </SelectItem>
                      ))}
                    {bookingTypes.length === 0 && (
                      <SelectItem value="production">Production</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  min="1"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter template description"
                rows={3}
              />
            </div>
          </div>

          {/* Studio Selection */}
          <div>
            <Label>Studios</Label>
            <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto border rounded-md p-3">
              {studios.map((studio) => (
                <div key={studio.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`studio-${studio.id}`}
                    checked={selectedStudioIds.includes(studio.id)}
                    onCheckedChange={() => handleStudioToggle(studio.id)}
                  />
                  <Label 
                    htmlFor={`studio-${studio.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {studio.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* PCR Room and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pcr-room">PCR Room (Optional)</Label>
              <Select value={pcrRoomId?.toString() || "none"} onValueChange={(value) => setPcrRoomId(value === "none" ? null : parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select PCR room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {pcrRooms.map((room) => (
                    <SelectItem key={room.id} value={room.id.toString()}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="booking-status">Booking Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="tentative">Tentative</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <Label htmlFor="booking-color">Booking Color</Label>
            <div className="flex items-center space-x-3 mt-2">
              <Input
                id="booking-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-20 h-10"
              />
              <span className="text-sm text-muted-foreground">
                Custom color for calendar display
              </span>
            </div>
          </div>

          {/* Notification Groups */}
          <div>
            <Label>Notification Groups</Label>
            <div className="grid grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-3">
              {notificationGroups.map((group) => (
                <div key={group.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`notify-${group.id}`}
                    checked={selectedNotifyGroups.includes(group.id)}
                    onCheckedChange={() => handleNotifyGroupToggle(group.id)}
                  />
                  <Label 
                    htmlFor={`notify-${group.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {group.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4">
            {template && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => deleteTemplate.mutate()}
                disabled={isLoading}
              >
                Delete Template
              </Button>
            )}
            
            <div className="flex space-x-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {template ? "Update Template" : "Create Template"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default TemplateForm;