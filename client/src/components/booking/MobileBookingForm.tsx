import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Studio, Template, PcrRoom, NotificationGroup } from "@shared/schema";
import { generateTimeOptions } from "@/lib/dateUtils";
import { BellRing, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// Interface must match the expected props from BookingModal
interface MobileBookingFormProps {
  formData: any;
  updateFormField: (field: string, value: any) => void;
  handleCrewToggle: (groupId: string) => void;
  studios: Studio[];
  templates: Template[];
  pcrRooms: PcrRoom[];
  notificationGroups: NotificationGroup[];
  isSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  alertsOnly: boolean;
  handleLoadTemplate: (templateId: number) => void;
}

export default function MobileBookingForm({
  formData,
  updateFormField,
  handleCrewToggle,
  studios,
  templates,
  pcrRooms,
  notificationGroups,
  isSaving,
  onSubmit,
  alertsOnly,
  handleLoadTemplate
}: MobileBookingFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-4">
        {/* Title and description section */}
        <div>
          <Label htmlFor="title" className="text-base font-medium">Title</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => updateFormField('title', e.target.value)}
            placeholder="Enter booking title"
            className="mt-1"
            required
          />
        </div>
        
        <div>
          <Label htmlFor="description" className="text-base font-medium">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => updateFormField('description', e.target.value)}
            placeholder="Enter booking details"
            className="mt-1"
            rows={3}
          />
        </div>

        {/* Accordion for sections */}
        <Accordion type="single" collapsible className="w-full">
          {/* Date and Time Section */}
          <AccordionItem value="date-time">
            <AccordionTrigger className="text-base font-medium">Date & Time</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => updateFormField('date', e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="start-time">Start Time</Label>
                  <Select 
                    value={formData.startTime} 
                    onValueChange={(value) => updateFormField('startTime', value)} 
                    required
                  >
                    <SelectTrigger id="start-time" className="mt-1">
                      <SelectValue placeholder="Select start time" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {generateTimeOptions().map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="end-time">End Time</Label>
                  <Select 
                    value={formData.endTime} 
                    onValueChange={(value) => updateFormField('endTime', value)} 
                    required
                  >
                    <SelectTrigger id="end-time" className="mt-1">
                      <SelectValue placeholder="Select end time" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {generateTimeOptions().map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Studio Selection Section */}
          {!alertsOnly && (
            <AccordionItem value="studios">
              <AccordionTrigger className="text-base font-medium">Studios</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {/* Studio selection */}
                  <div className="space-y-1 border rounded-md p-2 max-h-[200px] overflow-y-auto">
                    {studios.map((studio) => (
                      <div key={studio.id} className="flex items-center space-x-2 py-1">
                        <Checkbox
                          id={`studio-${studio.id}`}
                          checked={formData.studioIds.includes(studio.id.toString())}
                          onCheckedChange={(checked) => {
                            const currentStudioIds = [...formData.studioIds];
                            if (checked) {
                              if (!currentStudioIds.includes(studio.id.toString())) {
                                currentStudioIds.push(studio.id.toString());
                              }
                            } else {
                              const index = currentStudioIds.indexOf(studio.id.toString());
                              if (index !== -1) {
                                currentStudioIds.splice(index, 1);
                              }
                            }
                            updateFormField('studioIds', currentStudioIds);
                          }}
                        />
                        <Label
                          htmlFor={`studio-${studio.id}`}
                          className="cursor-pointer"
                        >
                          {studio.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {formData.studioIds.length === 0 && (
                    <p className="text-sm text-red-500 mt-1">At least one studio must be selected</p>
                  )}

                  {/* PCR Room Selection */}
                  <div className="mt-3">
                    <Label htmlFor="pcr-room">PCR Room</Label>
                    <Select 
                      value={formData.pcrRoomId?.toString() || ""} 
                      onValueChange={(value) => updateFormField('pcrRoomId', value ? parseInt(value) : null)}
                    >
                      <SelectTrigger id="pcr-room" className="mt-1">
                        <SelectValue placeholder="Select PCR room (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {pcrRooms.map((room) => (
                          <SelectItem key={room.id} value={room.id.toString()}>
                            {room.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Notification Groups Section */}
          <AccordionItem value="notifications">
            <AccordionTrigger className="text-base font-medium">Notifications</AccordionTrigger>
            <AccordionContent>
              <div>
                <div className="flex items-center mb-1">
                  <BellRing className="h-4 w-4 mr-1 text-primary" />
                  <Label>Notification Groups</Label>
                </div>
                
                {notificationGroups.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    No notification groups available
                  </p>
                ) : (
                  <div className="space-y-1 mt-1.5 border rounded-md p-2 max-h-[150px] overflow-y-auto">
                    {notificationGroups.map((group: NotificationGroup) => (
                      <div key={group.id} className="flex items-center justify-between">
                        <div className="flex items-center">
                          {group.groupType === 'camera' && <Tag className="h-3.5 w-3.5 mr-1 text-blue-500" />}
                          {group.groupType === 'lighting' && <Tag className="h-3.5 w-3.5 mr-1 text-yellow-500" />}
                          {group.groupType === 'sound' && <Tag className="h-3.5 w-3.5 mr-1 text-green-500" />}
                          {group.groupType === 'directors' && <Tag className="h-3.5 w-3.5 mr-1 text-purple-500" />}
                          {group.groupType === 'production' && <Tag className="h-3.5 w-3.5 mr-1 text-red-500" />}
                          {group.groupType === 'engineering' && <Tag className="h-3.5 w-3.5 mr-1 text-orange-500" />}
                          <span className="text-xs">{group.name}</span>
                        </div>
                        <Checkbox
                          id={`notify-group-${group.id}`}
                          checked={formData.notifyList.includes(group.id.toString())}
                          onCheckedChange={(checked) => handleCrewToggle(group.id.toString())}
                          className="h-4 w-4"
                        />
                      </div>
                    ))}
                  </div>
                )}
                
                {formData.notifyList.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {formData.notifyList.map((groupId: string) => {
                      const group = notificationGroups.find((g: NotificationGroup) => g.id.toString() === groupId);
                      if (!group) return null;
                      return (
                        <Badge key={groupId} variant="outline" className="flex items-center gap-1 text-xs py-0">
                          <span>{group.name}</span>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Additional Options Section */}
          <AccordionItem value="additional">
            <AccordionTrigger className="text-base font-medium">Additional Options</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {/* Templates */}
                {!alertsOnly && templates.length > 0 && (
                  <div>
                    <Label htmlFor="template">Load from Template</Label>
                    <Select onValueChange={(value) => handleLoadTemplate(parseInt(value))}>
                      <SelectTrigger id="template" className="mt-1">
                        <SelectValue placeholder="Select a template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id.toString()}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {/* Color picker */}
                {!alertsOnly && (
                  <div>
                    <Label htmlFor="color">Booking Color</Label>
                    <div className="flex items-center mt-1.5">
                      <Input
                        id="color"
                        type="color"
                        value={formData.color}
                        onChange={(e) => updateFormField('color', e.target.value)}
                        className="w-16 h-8 p-1 mr-2"
                      />
                      <span className="text-xs text-muted-foreground">
                        Custom color for calendar display
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Severity for alerts */}
                {alertsOnly && (
                  <div>
                    <Label htmlFor="severity">Severity</Label>
                    <Select 
                      value={formData.severity} 
                      onValueChange={(value) => updateFormField('severity', value)} 
                      required
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {/* Save as template option */}
                {!alertsOnly && (
                  <div className="flex flex-row items-start space-x-2 pt-2">
                    <Checkbox
                      id="save-template"
                      checked={formData.saveAsTemplate}
                      onCheckedChange={(checked) => updateFormField('saveAsTemplate', checked)}
                    />
                    <Label
                      htmlFor="save-template"
                      className="text-sm font-medium cursor-pointer"
                    >
                      Save as template for future bookings
                    </Label>
                  </div>
                )}
                
                {/* Template name if saving */}
                {formData.saveAsTemplate && (
                  <div>
                    <Label htmlFor="template-name">Template Name</Label>
                    <Input
                      id="template-name"
                      value={formData.templateName}
                      onChange={(e) => updateFormField('templateName', e.target.value)}
                      placeholder="Enter a name for this template"
                      required={formData.saveAsTemplate}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Submit Button */}
      <div className="pt-4">
        <Button
          type="submit"
          disabled={isSaving}
          className="w-full"
        >
          {isSaving ? (
            <span>Creating...</span>
          ) : (
            <span>{alertsOnly ? "Create Alert" : "Create Booking"}</span>
          )}
        </Button>
      </div>
    </form>
  );
}