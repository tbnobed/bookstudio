import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Resource, BookingResource } from '@shared/schema';
import { useToast } from './use-toast';

/**
 * Custom hook for managing resources
 * 
 * This hook provides queries and mutations for managing resources
 * and their relationships with bookings.
 */
export function useResources() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  /**
   * Get all resources, optionally filtered by category
   */
  const getAllResources = (category?: string) => {
    const queryKey = category 
      ? ['/api/resources', { category }] 
      : ['/api/resources'];

    return useQuery<Resource[]>({
      queryKey,
      staleTime: 10000, // 10 seconds
      retry: 1,
      onError: (error: Error) => {
        console.error('Error fetching resources:', error);
        toast({
          title: 'Error loading resources',
          description: 'Could not load resources. Please try again.',
          variant: 'destructive',
        });
      }
    });
  };

  /**
   * Get all resource categories
   */
  const getResourceCategories = () => {
    return useQuery<string[]>({
      queryKey: ['/api/resources/categories'],
      staleTime: 30000, // 30 seconds - categories don't change often
      retry: 1,
      initialData: [], // Return empty array as fallback data
      onError: (error: Error) => {
        console.error('Error fetching resource categories:', error);
      }
    });
  };

  /**
   * Get all resources assigned to a booking
   */
  const getBookingResources = (bookingId: number) => {
    return useQuery<(BookingResource & { resource: Resource })[]>({
      queryKey: ['/api/bookings', bookingId, 'resources'],
      enabled: !!bookingId,
      staleTime: 5000, // 5 seconds
      retry: 1,
      retryDelay: 1000, // Retry after 1 second
      initialData: [], // Return empty array as fallback data
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      onError: (error: Error) => {
        console.error(`Error fetching resources for booking ${bookingId}:`, error);
        toast({
          title: 'Error loading booking resources',
          description: 'Could not load resources for this booking. Please try again.',
          variant: 'destructive',
        });
      }
    });
  };

  /**
   * Create a new resource
   */
  const createResourceMutation = useMutation({
    mutationFn: async (data: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>) => {
      const response = await apiRequest('POST', '/api/resources', data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create resource');
      }
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/resources/categories'] });
      
      toast({
        title: 'Resource created',
        description: 'The resource has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create resource',
        description: error.message || 'Could not create the resource. Please try again.',
        variant: 'destructive',
      });
    },
  });

  /**
   * Update an existing resource
   */
  const updateResourceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Resource> }) => {
      const response = await apiRequest('PATCH', `/api/resources/${id}`, data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update resource');
      }
      return await response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      
      // If the category changed, invalidate categories
      if (variables.data.category) {
        queryClient.invalidateQueries({ queryKey: ['/api/resources/categories'] });
      }
      
      toast({
        title: 'Resource updated',
        description: 'The resource has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update resource',
        description: error.message || 'Could not update the resource. Please try again.',
        variant: 'destructive',
      });
    },
  });

  /**
   * Delete a resource
   */
  const deleteResourceMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/resources/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete resource');
      }
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      toast({
        title: 'Resource deleted',
        description: 'The resource has been deleted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete resource',
        description: error.message || 'Could not delete the resource. It may be in use by one or more bookings.',
        variant: 'destructive',
      });
    },
  });

  /**
   * Add a resource to a booking
   */
  const addBookingResourceMutation = useMutation({
    mutationFn: async ({
      bookingId,
      resourceId,
      quantity,
      notes,
    }: {
      bookingId: number;
      resourceId: number;
      quantity: number;
      notes?: string;
    }) => {
      const response = await apiRequest('POST', `/api/bookings/${bookingId}/resources`, {
        resourceId,
        quantity,
        notes,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add resource to booking');
      }
      
      return await response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate the booking resources query
      queryClient.invalidateQueries({ 
        queryKey: ['/api/bookings', variables.bookingId, 'resources'] 
      });
      
      toast({
        title: 'Resource added',
        description: 'The resource has been added to the booking successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to add resource',
        description: error.message || 'Could not add the resource to the booking. Please try again.',
        variant: 'destructive',
      });
    },
  });

  /**
   * Update a booking resource
   */
  const updateBookingResourceMutation = useMutation({
    mutationFn: async ({
      id,
      bookingId,
      data,
    }: {
      id: number;
      bookingId: number;
      data: { quantity: number; notes?: string };
    }) => {
      const response = await apiRequest('PATCH', `/api/bookings/${bookingId}/resources/${id}`, data);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update booking resource');
      }
      
      return await response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate the booking resources query
      queryClient.invalidateQueries({ 
        queryKey: ['/api/bookings', variables.bookingId, 'resources'] 
      });
      
      toast({
        title: 'Resource updated',
        description: 'The booking resource has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update resource',
        description: error.message || 'Could not update the resource. Please try again.',
        variant: 'destructive',
      });
    },
  });

  /**
   * Remove a resource from a booking
   */
  const removeBookingResourceMutation = useMutation({
    mutationFn: async ({ id, bookingId }: { id: number; bookingId: number }) => {
      const response = await apiRequest('DELETE', `/api/bookings/${bookingId}/resources/${id}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to remove resource from booking');
      }
      
      return id;
    },
    onSuccess: (_, variables) => {
      // Invalidate the booking resources query
      queryClient.invalidateQueries({ 
        queryKey: ['/api/bookings', variables.bookingId, 'resources'] 
      });
      
      toast({
        title: 'Resource removed',
        description: 'The resource has been removed from the booking successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to remove resource',
        description: error.message || 'Could not remove the resource from the booking. Please try again.',
        variant: 'destructive',
      });
    },
  });

  /**
   * Remove all resources from a booking
   */
  const removeAllBookingResourcesMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const response = await apiRequest('DELETE', `/api/bookings/${bookingId}/resources`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to remove all resources from booking');
      }
      
      return bookingId;
    },
    onSuccess: (bookingId) => {
      // Invalidate the booking resources query
      queryClient.invalidateQueries({ 
        queryKey: ['/api/bookings', bookingId, 'resources'] 
      });
      
      toast({
        title: 'Resources removed',
        description: 'All resources have been removed from the booking successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to remove resources',
        description: error.message || 'Could not remove resources from the booking. Please try again.',
        variant: 'destructive',
      });
    },
  });

  return {
    getAllResources,
    getResourceCategories,
    getBookingResources,
    createResourceMutation,
    updateResourceMutation,
    deleteResourceMutation,
    addBookingResourceMutation,
    updateBookingResourceMutation,
    removeBookingResourceMutation,
    removeAllBookingResourcesMutation,
  };
}