import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FileAttachment } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export type FileUploadParams = {
  bookingId: number;
  file: File;
  description?: string;
};

export function useFileAttachments(bookingId?: number) {
  const { toast } = useToast();
  
  // Get all attachments for a booking
  const {
    data: attachments = [],
    isLoading,
    error,
  } = useQuery<FileAttachment[]>({
    queryKey: ["/api/bookings", bookingId, "attachments"],
    queryFn: async () => {
      if (!bookingId) return [];
      const response = await fetch(`/api/bookings/${bookingId}/attachments`);
      if (!response.ok) {
        throw new Error("Failed to fetch attachments");
      }
      return response.json();
    },
    enabled: !!bookingId,
  });

  // Upload a file to a booking
  const uploadFileMutation = useMutation({
    mutationFn: async ({ bookingId, file, description }: FileUploadParams) => {
      const formData = new FormData();
      formData.append("file", file);
      if (description) {
        formData.append("description", description);
      }

      const response = await fetch(`/api/bookings/${bookingId}/attachments`, {
        method: "POST",
        body: formData,
        // Don't set Content-Type header - browser will set it with boundary for multipart/form-data
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to upload file");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate the attachments query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/bookings", bookingId, "attachments"] });
      toast({
        title: "File uploaded",
        description: "The file was uploaded successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete a file attachment
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: number) => {
      const response = await apiRequest("DELETE", `/api/attachments/${fileId}`);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate the attachments query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/bookings", bookingId, "attachments"] });
      toast({
        title: "File deleted",
        description: "The file was deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Download a file
  const downloadFile = (fileId: number, fileName: string) => {
    // Create a link and trigger download
    const downloadLink = document.createElement("a");
    downloadLink.href = `/api/attachments/${fileId}`;
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return {
    attachments,
    isLoading,
    error,
    uploadFile: uploadFileMutation.mutate,
    isUploading: uploadFileMutation.isPending,
    deleteFile: deleteFileMutation.mutate,
    isDeleting: deleteFileMutation.isPending,
    downloadFile,
  };
}