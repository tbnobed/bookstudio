import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InsertStudio, Studio } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface StudioManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  studio?: Studio; // Optional for edit mode
}

export default function StudioManagementModal({ isOpen, onClose, studio }: StudioManagementModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditMode = !!studio;

  // Form state
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [status, setStatus] = useState<string>("available");

  // Reset form when studio prop changes or modal opens/closes
  useEffect(() => {
    if (studio) {
      setName(studio.name);
      setDescription(studio.description || "");
      setStatus(studio.status);
    } else {
      // Default values for new studio
      setName("");
      setDescription("");
      setStatus("available");
    }
  }, [studio, isOpen]);

  // Create or update studio
  const mutation = useMutation({
    mutationFn: async (data: Partial<InsertStudio>) => {
      let response;
      if (isEditMode && studio) {
        // Update existing studio
        response = await apiRequest("PATCH", `/api/studios/${studio.id}`, data);
      } else {
        // Create new studio
        response = await apiRequest("POST", "/api/studios", data as InsertStudio);
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch studio data
      queryClient.invalidateQueries({ queryKey: ["/api/studios"] });
      
      // Show success message
      toast({
        title: `Studio ${isEditMode ? "updated" : "created"} successfully`,
        description: `Studio "${name}" has been ${isEditMode ? "updated" : "created"}.`,
        variant: "default",
      });
      
      // Close modal
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEditMode ? "update" : "create"} studio`,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Studio name is required",
        variant: "destructive",
      });
      return;
    }

    // Prepare data
    const studioData: Partial<InsertStudio> = {
      name,
      description: description || null,
      status
    };

    // Submit data
    mutation.mutate(studioData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Studio" : "Add New Studio"}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Update the studio information below." 
              : "Fill in the details to create a new studio."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Studio Name</Label>
            <Input 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Studio A"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea 
              id="description" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Studio details, equipment, etc."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select 
              value={status} 
              onValueChange={setStatus}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="maintenance">Under Maintenance</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Saving..." : isEditMode ? "Update Studio" : "Create Studio"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}