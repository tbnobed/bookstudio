import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileAttachment } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";

export type FileUploadParams = {
  bookingId: number;
  file: File;
  description?: string;
};

/**
 * Hook for managing file attachments for a booking
 * 
 * @param bookingId Optional booking ID to filter attachments by
 * @returns Object with file attachments, loading state, and mutation functions
 */
export function useFileAttachments(bookingId?: number) {
  const queryClient = useQueryClient();
  const [isDownloading, setIsDownloading] = useState(false);

  // Build query key based on whether bookingId is provided
  const queryKey = bookingId 
    ? ['/api/bookings', bookingId, 'attachments']
    : ['/api/file-attachments'];
    
  // Fetch attachments for the booking
  const { 
    data: attachments = [], 
    isLoading, 
    error 
  } = useQuery<FileAttachment[]>({
    queryKey,
    staleTime: 1000 * 60, // 1 minute
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async ({ bookingId, file, description }: FileUploadParams) => {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bookingId', bookingId.toString());
      
      if (description) {
        formData.append('description', description);
      }
      
      // Upload file with multipart/form-data
      const response = await fetch(`/api/bookings/${bookingId}/attachments`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload file');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate the attachments query to trigger a refetch
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
      console.error('File upload error:', error);
    },
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: number) => {
      const response = await apiRequest('DELETE', `/api/attachments/${fileId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete file');
      }
    },
    onSuccess: () => {
      // Invalidate the attachments query to trigger a refetch
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => {
      console.error('File deletion error:', error);
    },
  });

  /**
   * Download a file attachment
   * 
   * @param fileId ID of the file to download
   * @param fileName Name to use for the downloaded file
   */
  const downloadFile = async (fileId: number, fileName: string) => {
    try {
      setIsDownloading(true);
      
      // Fetch the file
      const response = await fetch(`/api/file-attachments/${fileId}/download`);
      
      if (!response.ok) {
        throw new Error('Failed to download file');
      }
      
      // Convert response to blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      
      // Add to document, click, and remove
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  return {
    // Data
    attachments,
    isLoading,
    error,
    
    // Mutations
    uploadFile: uploadFileMutation.mutateAsync,
    isUploading: uploadFileMutation.isPending,
    deleteFile: deleteFileMutation.mutateAsync,
    isDeleting: deleteFileMutation.isPending,
    
    // Actions
    downloadFile,
    isDownloading,
  };
}