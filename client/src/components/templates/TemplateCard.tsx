import React from 'react';
import { Template } from '@shared/schema';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TemplateCardProps {
  template: Template;
  studios?: any[];
  pcrRooms?: any[];
  onEdit?: (template: Template) => void;
  onDelete?: (template: Template) => void;
  isEditable?: boolean;
}

export default function TemplateCard({
  template,
  studios = [],
  pcrRooms = [],
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
  
  // Render notification groups from notifyList
  const renderNotificationGroups = () => {
    if (!template.notifyList || !Array.isArray(template.notifyList) || template.notifyList.length === 0) {
      return null;
    }
    
    return (
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-500 mb-1">Notification Groups:</p>
        <div className="flex flex-wrap gap-1">
          {template.notifyList.map((groupId, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              Group {groupId}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  // Render studio information
  const renderStudioInfo = () => {
    if (!template.studioIds || !Array.isArray(template.studioIds) || template.studioIds.length === 0) {
      return null;
    }

    // Get studio names from IDs
    const studioNames = template.studioIds.map(id => {
      const studio = studios.find(s => s.id === id);
      return studio ? studio.name : `Studio ${id}`;
    });

    return (
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-500 mb-1">Studios:</p>
        <div className="flex flex-wrap gap-1">
          {studioNames.map((name, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {name}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  // Render PCR Room information
  const renderPcrRoomInfo = () => {
    if (!template.pcrRoomId) return null;

    // Get PCR room name from ID
    const pcrRoom = pcrRooms.find(pcr => pcr.id === template.pcrRoomId);
    const pcrRoomName = pcrRoom ? pcrRoom.name : `PCR Room ${template.pcrRoomId}`;

    return (
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-500 mb-1">PCR Room:</p>
        <Badge variant="outline" className="text-xs">
          {pcrRoomName}
        </Badge>
      </div>
    );
  };

  // Render time information
  const renderTimeInfo = () => {
    if (!template.startTime && !template.endTime) return null;

    return (
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-500 mb-1">Default Times:</p>
        <div className="flex flex-wrap gap-1">
          {template.startTime && (
            <Badge variant="outline" className="text-xs">
              Start: {template.startTime}
            </Badge>
          )}
          {template.endTime && (
            <Badge variant="outline" className="text-xs">
              End: {template.endTime}
            </Badge>
          )}
        </div>
      </div>
    );
  };

  // Render status and color information
  const renderStatusInfo = () => {
    const hasStatus = template.status && template.status !== 'confirmed';
    const hasColor = template.color;
    
    if (!hasStatus && !hasColor) return null;

    return (
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-500 mb-1">Settings:</p>
        <div className="flex flex-wrap gap-1">
          {hasStatus && (
            <Badge variant="outline" className="text-xs">
              Status: {template.status}
            </Badge>
          )}
          {hasColor && (
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <div 
                className="w-2 h-2 rounded-full border border-gray-300" 
                style={{ backgroundColor: template.color || undefined }}
              ></div>
              Custom color
            </Badge>
          )}
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
        
        {renderStudioInfo()}
        {renderPcrRoomInfo()}
        {renderTimeInfo()}
        {renderStatusInfo()}
        {renderNotificationGroups()}
        
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