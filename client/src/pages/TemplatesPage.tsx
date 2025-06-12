import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Template } from "@shared/schema";
import { Button } from "@/components/ui/button";
import TemplateForm from "@/components/templates/TemplateForm";
import TemplateCard from "@/components/templates/TemplateCard";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TemplatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  
  // Fetch templates
  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
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
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete template",
        variant: "destructive",
      });
    },
  });

  // Format booking type for display
  const formatTemplateType = (type: string) => {
    return type.replace("_", " ").split(" ").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
  };

  // Format duration
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `${mins} minute${mins !== 1 ? 's' : ''}`;
    }
  };

  // Get color for template type
  const getTemplateTypeColor = (type: string) => {
    switch (type) {
      case "production":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "maintenance":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "it_support":
        return "bg-red-100 text-red-800 border-red-300";
      case "rehearsal":
        return "bg-purple-100 text-purple-800 border-purple-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  // Filter templates
  const userTemplates = templates.filter(template => 
    template.createdBy === user?.id
  );
  
  const otherTemplates = templates.filter(template => 
    template.createdBy !== user?.id
  );

  // Handle delete template
  const handleDeleteTemplate = (template: Template) => {
    if (confirm("Are you sure you want to delete this template?")) {
      deleteTemplate.mutate(template.id);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Header
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        view="week"
        onViewChange={() => {}}
        title="Templates"
      />
      
      <div className="container mx-auto p-4 pb-16 overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Booking Templates</h1>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Create Template
          </Button>
        </div>

        <Tabs defaultValue="my-templates" className="w-full">
          <TabsList>
            <TabsTrigger value="my-templates">My Templates</TabsTrigger>
            <TabsTrigger value="all-templates">All Templates</TabsTrigger>
          </TabsList>
          
          <TabsContent value="my-templates">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : userTemplates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                You haven't created any templates yet.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {userTemplates.map(template => (
                  <TemplateCard 
                    key={template.id}
                    template={template}
                    onEdit={(template) => setEditTemplate(template)}
                    onDelete={(template) => handleDeleteTemplate(template)}
                    isEditable={true}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="all-templates">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : otherTemplates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No templates available from other users.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {otherTemplates.map(template => (
                  <TemplateCard 
                    key={template.id}
                    template={template}
                    onEdit={(template) => setEditTemplate(template)}
                    onDelete={(template) => handleDeleteTemplate(template)}
                    isEditable={user?.role === "admin"}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Template Modal */}
      <TemplateForm
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Edit Template Modal */}
      {editTemplate && (
        <TemplateForm
          isOpen={!!editTemplate}
          onClose={() => setEditTemplate(null)}
          template={editTemplate}
        />
      )}
    </div>
  );
}
