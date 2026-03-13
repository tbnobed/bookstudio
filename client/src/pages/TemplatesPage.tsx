import { useState, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Template } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TemplateForm from "@/components/templates/TemplateForm";
import TemplateCard from "@/components/templates/TemplateCard";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Search, X } from "lucide-react";

export default function TemplatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [showForceDeleteDialog, setShowForceDeleteDialog] = useState(false);
  const [forceDeleteError, setForceDeleteError] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  
  // Fetch templates
  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  // Fetch studios for displaying studio names in templates
  const { data: studios = [] } = useQuery({
    queryKey: ["/api/studios"],
  });

  // Fetch PCR rooms for displaying PCR room names in templates
  const { data: pcrRooms = [] } = useQuery({
    queryKey: ["/api/pcr-rooms"],
  });

  // Delete template mutation
  const deleteTemplate = useMutation({
    mutationFn: async ({ id, force = false }: { id: number; force?: boolean }) => {
      const url = force ? `/api/templates/${id}?force=true` : `/api/templates/${id}`;
      const res = await apiRequest("DELETE", url);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(JSON.stringify(errorData));
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Success!",
        description: variables.force 
          ? "Template deleted successfully (removed from associated bookings)."
          : "Template deleted successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setSelectedTemplate(null);
    },
    onError: (error: any) => {
      console.log("Template delete error:", error);
      console.log("Error message:", error.message);
      
      try {
        const errorData = JSON.parse(error.message);
        console.log("Parsed error data:", errorData);
        
        if (errorData.canForceDelete) {
          // Show force delete option
          setForceDeleteError(errorData);
          setShowForceDeleteDialog(true);
        } else {
          toast({
            title: "Error",
            description: errorData.message || "Failed to delete template",
            variant: "destructive",
          });
        }
      } catch (parseError) {
        console.log("Parse error:", parseError);
        
        // If we can't parse the error, check if it contains force delete hints
        const errorMessage = error.message || "";
        if (errorMessage.includes("canForceDelete") || errorMessage.includes("forceDeleteHint")) {
          // Extract the error data from the raw message
          try {
            const match = errorMessage.match(/\{.*\}/);
            if (match) {
              const errorData = JSON.parse(match[0]);
              if (errorData.canForceDelete) {
                setForceDeleteError(errorData);
                setShowForceDeleteDialog(true);
                return;
              }
            }
          } catch (extractError) {
            console.log("Failed to extract error data:", extractError);
          }
        }
        
        toast({
          title: "Error",
          description: error.message || "Failed to delete template",
          variant: "destructive",
        });
      }
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

  // Derive available types from all templates for the filter dropdown
  const availableTypes = useMemo(() => {
    const types = new Set(templates.map(t => t.type));
    return Array.from(types).sort();
  }, [templates]);

  // Apply search + type filter helper
  const applyFilters = (list: Template[]) => {
    const q = searchQuery.trim().toLowerCase();
    return list.filter(template => {
      const matchesType = typeFilter === "all" || template.type === typeFilter;
      const matchesSearch =
        !q ||
        template.name.toLowerCase().includes(q) ||
        (template.description ?? "").toLowerCase().includes(q) ||
        template.type.toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  };

  // Filter templates
  const userTemplates = applyFilters(
    templates.filter(template => template.createdBy === user?.id)
  );
  
  const otherTemplates = applyFilters(
    templates.filter(template => template.createdBy !== user?.id)
  );

  const hasActiveFilters = searchQuery.trim() !== "" || typeFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
  };

  // Handle delete template
  const handleDeleteTemplate = (template: Template) => {
    setSelectedTemplate(template);
    deleteTemplate.mutate({ id: template.id, force: false });
  };

  // Handle force delete confirmation
  const handleForceDelete = () => {
    setShowForceDeleteDialog(false);
    if (selectedTemplate) {
      deleteTemplate.mutate({ id: selectedTemplate.id, force: true });
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
        showViewToggle={false}
      />
      
      <div className="w-full px-4 pb-16 overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Booking Templates</h1>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Create Template
          </Button>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Search by name, description, or type..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {availableTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0 text-gray-500 hover:text-gray-800">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        <Tabs defaultValue="my-templates" className="w-full">
          <TabsList>
            <TabsTrigger value="my-templates">
              My Templates
              {!isLoading && (
                <span className="ml-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full px-1.5 py-0.5">
                  {userTemplates.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="all-templates">
              Other Templates
              {!isLoading && (
                <span className="ml-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full px-1.5 py-0.5">
                  {otherTemplates.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="my-templates">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : userTemplates.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                {hasActiveFilters
                  ? "No templates match your search or filters."
                  : "You haven't created any templates yet."}
                {hasActiveFilters && (
                  <div className="mt-2">
                    <button onClick={clearFilters} className="text-sm text-primary underline hover:no-underline">
                      Clear filters
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {userTemplates.map(template => (
                  <TemplateCard 
                    key={template.id}
                    template={template}
                    studios={studios}
                    pcrRooms={pcrRooms}
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
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                {hasActiveFilters
                  ? "No templates match your search or filters."
                  : "No templates available from other users."}
                {hasActiveFilters && (
                  <div className="mt-2">
                    <button onClick={clearFilters} className="text-sm text-primary underline hover:no-underline">
                      Clear filters
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {otherTemplates.map(template => (
                  <TemplateCard 
                    key={template.id}
                    template={template}
                    studios={studios}
                    pcrRooms={pcrRooms}
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

      {/* Force Delete Confirmation Dialog */}
      <Dialog open={showForceDeleteDialog} onOpenChange={setShowForceDeleteDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-orange-600">Force Delete Template</DialogTitle>
            <DialogDescription className="pt-2">
              This template has associated data that prevents normal deletion.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800 font-medium mb-2">
                Dependency Warning:
              </p>
              <p className="text-sm text-orange-700">
                {forceDeleteError?.message}
              </p>
            </div>
            
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium mb-2">
                Force deletion will:
              </p>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Remove template reference from all associated bookings</li>
                <li>• Permanently delete the template</li>
                <li>• Associated bookings will remain but no longer reference this template</li>
              </ul>
            </div>

            <p className="text-sm text-gray-600">
              Are you sure you want to force delete template <strong>{selectedTemplate?.name}</strong>?
            </p>
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowForceDeleteDialog(false)}
              disabled={deleteTemplate.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              onClick={handleForceDelete}
              disabled={deleteTemplate.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {deleteTemplate.isPending ? "Force Deleting..." : "Force Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
