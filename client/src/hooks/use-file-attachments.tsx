import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileAttachment } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useState, useMemo, useEffect } from "react";

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
  // Ensure we use the correct endpoint path format
  const queryKey = bookingId 
    ? ['/api/bookings', bookingId.toString(), 'attachments']
    : ['/api/file-attachments'];
    
  console.log(`[useFileAttachments] Fetching attachments for booking ID: ${bookingId || 'none'}`);
  console.log(`[useFileAttachments] Using query key:`, queryKey);
    
  // Custom data validator to ensure we're only working with valid file attachments
  const validateAttachments = (data: any): FileAttachment[] => {
    if (!Array.isArray(data)) {
      console.error('[useFileAttachments] Response is not an array:', data);
      return [];
    }
    
    // Filter to only include data that matches the FileAttachment shape
    return data.filter(item => 
      item && 
      typeof item === 'object' && 
      typeof item.id === 'number' &&
      typeof item.fileName === 'string' &&
      typeof item.fileSize === 'number' &&
      item.mimeType !== undefined
    );
  };
  
  // Fetch attachments for the booking
  const { 
    data: rawAttachments = [], 
    isLoading, 
    error,
    isError
  } = useQuery<any[], Error>({
    queryKey,
    staleTime: 1000 * 60, // 1 minute
    retry: false, // Don't retry if we get an error (like 401)
    enabled: !!bookingId, // Only run query if bookingId is provided
  });
  
  // Process and validate the attachments
  const attachments = useMemo(() => {
    return validateAttachments(rawAttachments);
  }, [rawAttachments]);

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
      try {
        const response = await fetch(`/api/attachments/${fileId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to delete file');
        }
        
        return await response.json().catch(() => ({}));
      } catch (error) {
        console.error('Delete file error:', error);
        throw error;
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
      const response = await fetch(`/api/attachments/${fileId}`);
      
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
    isError,
    
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