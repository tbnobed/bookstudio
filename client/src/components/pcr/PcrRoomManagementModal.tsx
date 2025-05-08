import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PcrRoom, InsertPcrRoom } from "@shared/schema";

const pcrRoomSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  status: z.string().default("available")
});

interface PcrRoomManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  pcrRoom?: PcrRoom;
}

export default function PcrRoomManagementModal({ isOpen, onClose, pcrRoom }: PcrRoomManagementModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditMode = !!pcrRoom;

  const form = useForm<z.infer<typeof pcrRoomSchema>>({
    resolver: zodResolver(pcrRoomSchema),
    defaultValues: {
      name: pcrRoom?.name || "",
      description: pcrRoom?.description || "",
      status: pcrRoom?.status || "available"
    }
  });

  // Update form when pcrRoom changes
  useEffect(() => {
    if (pcrRoom) {
      form.reset({
        name: pcrRoom.name,
        description: pcrRoom.description,
        status: pcrRoom.status
      });
    } else {
      form.reset({
        name: "",
        description: "",
        status: "available"
      });
    }
  }, [pcrRoom, form]);

  // Create PCR Room mutation
  const createPcrRoomMutation = useMutation({
    mutationFn: async (data: InsertPcrRoom) => {
      const res = await apiRequest("POST", "/api/pcr-rooms", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "PCR Room created",
        description: "PCR Room has been created successfully",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pcr-rooms"] });
      onClose();
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create PCR Room",
        variant: "destructive",
      });
    },
  });
  
  // Update PCR Room with full data mutation
  const updateFullPcrRoomMutation = useMutation({
    mutationFn: async (data: { id: number; description: string | null; status: string }) => {
      const res = await apiRequest("PATCH", `/api/pcr-rooms/${data.id}`, {
        description: data.description,
        status: data.status
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "PCR Room updated",
        description: "PCR Room has been updated successfully",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pcr-rooms"] });
      onClose();
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update PCR Room",
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const onSubmit = async (data: z.infer<typeof pcrRoomSchema>) => {
    if (isEditMode && pcrRoom) {
      // Update the PCR room with all form data
      updateFullPcrRoomMutation.mutate({ 
        id: pcrRoom.id, 
        description: data.description, 
        status: data.status 
      });
    } else {
      // Create new PCR Room
      createPcrRoomMutation.mutate(data);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? `Edit PCR Room: ${pcrRoom?.name}` : "Add PCR Room"}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Update the PCR Room" 
              : "Add a new Production Control Room to the system"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="PCR Room name" 
                      {...field} 
                      disabled={isEditMode}
                    />
                  </FormControl>
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
                      placeholder="Optional description" 
                      {...field} 
                      value={field.value || ""}
                      disabled={isEditMode}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="outofservice">Out of Service</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={createPcrRoomMutation.isPending || updateFullPcrRoomMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createPcrRoomMutation.isPending || updateFullPcrRoomMutation.isPending}
              >
                {createPcrRoomMutation.isPending || updateFullPcrRoomMutation.isPending 
                  ? "Processing..." 
                  : isEditMode ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}