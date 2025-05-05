import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PcrRoom } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import PcrRoomManagementModal from "@/components/pcr/PcrRoomManagementModal";
import { Badge } from "@/components/ui/badge";

export default function PcrRoomsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPcrRoomModalOpen, setIsPcrRoomModalOpen] = useState(false);
  const [selectedPcrRoom, setSelectedPcrRoom] = useState<PcrRoom | undefined>(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pcrRoomToDelete, setPcrRoomToDelete] = useState<PcrRoom | null>(null);

  // Fetch PCR rooms
  const { data: pcrRooms = [], isLoading } = useQuery<PcrRoom[]>({
    queryKey: ["/api/pcr-rooms"],
  });

  // Update PCR room status mutation
  const updatePcrRoomStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/pcr-rooms/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "PCR room status updated successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pcr-rooms"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update PCR room status",
        variant: "destructive",
      });
    },
  });

  // Delete PCR room mutation
  const deletePcrRoomMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/pcr-rooms/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "PCR room deleted successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pcr-rooms"] });
      setIsDeleteDialogOpen(false);
      setPcrRoomToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete PCR room. It may be associated with active bookings.",
        variant: "destructive",
      });
    },
  });

  const handleDeletePcrRoom = (pcrRoom: PcrRoom) => {
    setPcrRoomToDelete(pcrRoom);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeletePcrRoom = () => {
    if (pcrRoomToDelete) {
      deletePcrRoomMutation.mutate(pcrRoomToDelete.id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "available":
        return <Badge className="bg-green-500">Available</Badge>;
      case "maintenance":
        return <Badge className="bg-amber-500">Maintenance</Badge>;
      case "outofservice":
        return <Badge className="bg-red-500">Out of Service</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>PCR Room Management</CardTitle>
        <CardDescription>Manage Production Control Rooms</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Name</th>
                  <th className="text-left py-3 px-4 font-medium">Description</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium">Available</th>
                  <th className="text-left py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center">Loading PCR rooms...</td>
                  </tr>
                ) : pcrRooms.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center">No PCR rooms available. Add one to get started.</td>
                  </tr>
                ) : (
                  pcrRooms.map((pcrRoom) => (
                    <tr key={pcrRoom.id} className="border-b">
                      <td className="py-3 px-4">{pcrRoom.name}</td>
                      <td className="py-3 px-4">{pcrRoom.description || "-"}</td>
                      <td className="py-3 px-4">{getStatusBadge(pcrRoom.status)}</td>
                      <td className="py-3 px-4">
                        <Switch 
                          checked={pcrRoom.status === "available"} 
                          onCheckedChange={(checked) => {
                            updatePcrRoomStatus.mutate({
                              id: pcrRoom.id,
                              status: checked ? "available" : "outofservice"
                            });
                          }}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedPcrRoom(pcrRoom);
                              setIsPcrRoomModalOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeletePcrRoom(pcrRoom)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <Button
            onClick={() => {
              setSelectedPcrRoom(undefined);
              setIsPcrRoomModalOpen(true);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add PCR Room
          </Button>
          
          {/* PCR Room Management Modal */}
          <PcrRoomManagementModal
            isOpen={isPcrRoomModalOpen}
            onClose={() => setIsPcrRoomModalOpen(false)}
            pcrRoom={selectedPcrRoom}
          />
          
          {/* Delete PCR Room Confirmation Dialog */}
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the PCR room
                  <strong>{pcrRoomToDelete ? ` "${pcrRoomToDelete.name}"` : ""}</strong> from the system.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deletePcrRoomMutation.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={confirmDeletePcrRoom} 
                  disabled={deletePcrRoomMutation.isPending}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deletePcrRoomMutation.isPending ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}