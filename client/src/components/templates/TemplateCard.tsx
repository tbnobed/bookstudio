import React from 'react';
import { Template } from '@shared/schema';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TemplateCardProps {
  template: Template;
  onEdit?: (template: Template) => void;
  onDelete?: (template: Template) => void;
  isEditable?: boolean;
}

export default function TemplateCard({
  template,
  onEdit,
  onDelete,
  isEditable = false
}: TemplateCardProps) {
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
  
  // Get correct notification group names
  const renderNotificationGroups = () => {
    if (!template.crewRequired) {
      return null;
    }
    
    // Handle different potential types of crewRequired
    let crewItems: any[] = [];
    
    if (Array.isArray(template.crewRequired)) {
      crewItems = template.crewRequired;
    } else if (typeof template.crewRequired === 'object') {
      // Try to convert object to array for rendering
      try {
        const crewObj = template.crewRequired as any;
        if (crewObj.notificationGroups && Array.isArray(crewObj.notificationGroups)) {
          crewItems = crewObj.notificationGroups;
        } else {
          // Fallback - try to display object keys
          crewItems = Object.keys(crewObj).map(key => ({name: key}));
        }
      } catch (e) {
        console.error("Error processing template notification groups", e);
        return null;
      }
    }
    
    if (crewItems.length === 0) {
      return null;
    }
    
    return (
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 mb-1">Notification Groups:</p>
        <div className="flex flex-wrap gap-1">
          {crewItems.map((crew, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {typeof crew === 'object' 
                ? (crew.name || crew.id || JSON.stringify(crew)) 
                : String(crew)}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  // Check if we have additional template data
  const hasAdditionalData = () => {
    return template.equipment && 
           typeof template.equipment === 'object' && 
           Array.isArray(template.equipment) && 
           template.equipment.length > 0 && 
           typeof template.equipment[0] === 'object';
  };

  // Render template configuration details
  const renderConfigSummary = () => {
    if (!hasAdditionalData()) return null;
    
    // Use type assertion since TypeScript can't know the structure
    const additionalData = (template.equipment as any)[0];
    
    let settings = [];
    if (additionalData.studioIds && Array.isArray(additionalData.studioIds)) {
      settings.push(`${additionalData.studioIds.length} studios`);
    }
    if (additionalData.pcrRoomId) {
      settings.push('PCR Room');
    }
    if (additionalData.status) {
      settings.push(`Status: ${additionalData.status}`);
    }
    if (additionalData.color) {
      settings.push('Custom color');
    }
    
    if (settings.length === 0) return null;
    
    return (
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 mb-1">Template Configuration:</p>
        <div className="flex flex-wrap gap-1">
          {settings.map((setting, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {setting}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  // Handle action buttons
  const handleEdit = () => {
    if (onEdit) onEdit(template);
  };

  const handleDelete = () => {
    if (onDelete) onDelete(template);
  };

  return (
    <Card className="overflow-hidden">
      <div className={`h-2 ${getTemplateTypeColor(template.type).split(" ")[0]}`}></div>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-lg">{template.name}</h3>
          <Badge variant="outline" className={getTemplateTypeColor(template.type)}>
            {formatTemplateType(template.type)}
          </Badge>
        </div>
        
        <p className="text-sm text-gray-500 mb-2">Duration: {formatDuration(template.duration)}</p>
        
        {template.description && (
          <p className="text-sm text-gray-600 mb-4">{template.description}</p>
        )}
        
        {renderNotificationGroups()}
        {renderConfigSummary()}
        
        {isEditable && (
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" size="sm" onClick={handleEdit}>
              Edit
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}