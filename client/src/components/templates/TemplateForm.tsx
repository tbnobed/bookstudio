import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
  
  // State for form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("production");
  const [duration, setDuration] = useState("60");
  const [crewRequired, setCrewRequired] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);

  // Set initial form values when editing
  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setType(template.type);
      setDuration(template.duration.toString());
      setCrewRequired(template.crewRequired as string[] || []);
      setEquipment(template.equipment as string[] || []);
    } else {
      // Reset form when creating a new template
      setName("");
      setDescription("");
      setType("production");
      setDuration("60");
      setCrewRequired([]);
      setEquipment([]);
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

  // Delete template mutation
  const deleteTemplate = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/templates/${id}`);
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

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    const templateData: InsertTemplate = {
      name,
      description,
      type,
      duration: parseInt(duration),
      crewRequired,
      equipment,
      createdBy: user.id,
    };
    
    createTemplate.mutateAsync(templateData);
  };

  // Toggle crew selection
  const handleCrewToggle = (crew: string) => {
    if (crewRequired.includes(crew)) {
      setCrewRequired(crewRequired.filter(c => c !== crew));
    } else {
      setCrewRequired([...crewRequired, crew]);
    }
  };

  // Toggle equipment selection
  const handleEquipmentToggle = (item: string) => {
    if (equipment.includes(item)) {
      setEquipment(equipment.filter(e => e !== item));
    } else {
      setEquipment([...equipment, item]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{template ? "Edit Template" : "Create Template"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter template name"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="type">Template Type</Label>
            <Select value={type} onValueChange={setType} required>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="it_support">IT Support</SelectItem>
                <SelectItem value="rehearsal">Rehearsal</SelectItem>
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
              placeholder="Enter duration in minutes"
              min="15"
              step="15"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details about this template"
              rows={3}
            />
          </div>
          
          <div>
            <Label>Required Crew</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {["Camera Operators", "Sound Engineers", "Lighting Technicians", "Production Assistants", "Directors"].map((crew) => (
                <div key={crew} className="flex items-center space-x-2">
                  <Checkbox
                    id={`crew-${crew}`}
                    checked={crewRequired.includes(crew)}
                    onCheckedChange={() => handleCrewToggle(crew)}
                  />
                  <label
                    htmlFor={`crew-${crew}`}
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {crew}
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <Label>Required Equipment</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {["Cameras", "Microphones", "Lights", "Green Screen", "Teleprompter", "Recording Equipment"].map((item) => (
                <div key={item} className="flex items-center space-x-2">
                  <Checkbox
                    id={`equipment-${item}`}
                    checked={equipment.includes(item)}
                    onCheckedChange={() => handleEquipmentToggle(item)}
                  />
                  <label
                    htmlFor={`equipment-${item}`}
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {item}
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          <DialogFooter className="flex justify-between">
            {template && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => template && deleteTemplate.mutateAsync(template.id)}
                disabled={deleteTemplate.isPending}
              >
                {deleteTemplate.isPending ? "Deleting..." : "Delete Template"}
              </Button>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTemplate.isPending}>
                {createTemplate.isPending ? "Saving..." : (template ? "Update Template" : "Create Template")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
