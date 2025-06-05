import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Template, InsertTemplate } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface TemplateFormProps {
  isOpen: boolean;
  onClose: () => void;
  template?: Template;
}

export default function TemplateForm({ 
  isOpen, 
  onClose, 
  template 
}: TemplateFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for form fields - matching booking form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("production");
  const [duration, setDuration] = useState("60");

  // Set initial form values when editing
  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setType(template.type);
      setDuration(template.duration.toString());
    } else {
      // Reset form when creating a new template
      setName("");
      setDescription("");
      setType("production");
      setDuration("60");
    }
  }, [template, isOpen]);

  // Create template mutation
  const createTemplate = useMutation({
    mutationFn: async (templateData: InsertTemplate) => {
      const res = await apiRequest("POST", "/api/templates", templateData);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Template created successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create template",
        variant: "destructive",
      });
    },
  });

  // Update template mutation
  const updateTemplate = useMutation({
    mutationFn: async (templateData: Partial<Template>) => {
      const res = await apiRequest("PATCH", `/api/templates/${template?.id}`, templateData);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Template updated successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update template",
        variant: "destructive",
      });
    },
  });

  // Delete template mutation
  const deleteTemplate = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/templates/${template?.id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Template deleted successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete template",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    const templateData: InsertTemplate = {
      name,
      description,
      type,
      duration: parseInt(duration),
      crewRequired: [], // Keep as empty array for schema compatibility
      equipment: [], // Keep as empty array for schema compatibility
      createdBy: user.id
    };
    
    if (template) {
      updateTemplate.mutate(templateData);
    } else {
      createTemplate.mutate(templateData);
    }
  };

  const handleDelete = () => {
    if (template && window.confirm("Are you sure you want to delete this template?")) {
      deleteTemplate.mutate();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {template ? "Edit Template" : "Create Template"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter template name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Template Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Select template type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="rehearsal">Rehearsal</SelectItem>
                <SelectItem value="it_support">IT Support</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input
              id="duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="60"
              min="1"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details about this template"
              rows={3}
            />
          </div>

          <DialogFooter className="flex justify-between">
            <div>
              {template && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteTemplate.isPending}
                >
                  {deleteTemplate.isPending ? "Deleting..." : "Delete Template"}
                </Button>
              )}
            </div>
            <div className="flex space-x-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createTemplate.isPending || updateTemplate.isPending}
              >
                {createTemplate.isPending || updateTemplate.isPending 
                  ? (template ? "Updating..." : "Creating...") 
                  : (template ? "Update Template" : "Create Template")
                }
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}