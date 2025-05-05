import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Resource, BookingResource } from '@shared/schema';
import { useToast } from './use-toast';
import { useEffect } from 'react';

export function useResources() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all resources
  const getAllResources = (category?: string) => {
    const queryKey = category 
      ? ['/api/resources', { category }] 
      : ['/api/resources'];

    return useQuery<Resource[]>({
      queryKey,
      staleTime: 10000, // 10 seconds
    });
  };

  // Fetch categories
  const getResourceCategories = () => {
    return useQuery<string[]>({
      queryKey: ['/api/resources/categories'],
      staleTime: 10000, // 10 seconds
      // Return empty array as fallback data in case of errors
      retry: false,
      initialData: []
    });
  };

  // Fetch resources for a booking
  const getBookingResources = (bookingId: number) => {
    const { data, ...rest } = useQuery<(BookingResource & { resource: Resource })[]>({
      queryKey: ['/api/bookings', bookingId, 'resources'],
      enabled: !!bookingId,
      staleTime: 1000, // 1 second - shorter stale time for more frequent refetches
      retry: 2, // Allow two retries
      retryDelay: 1000, // Retry after 1 second
      initialData: [], // Return empty array as fallback data
      refetchOnMount: 'always', // Always refetch when component mounts
      refetchOnWindowFocus: true // Also refetch when window gains focus
    });
    
    // If any resource is missing its resource data, force a refetch
    useEffect(() => {
      if (data && data.length > 0) {
        const hasMissingResource = data.some(item => !item.resource || !item.resource.name);
        if (hasMissingResource) {
          console.log('Detected resource with missing data, forcing refetch');
          
          // Add a small delay before refetching to allow server time to process
          const timeoutId = setTimeout(() => {
            queryClient.invalidateQueries({ 
              queryKey: ['/api/bookings', bookingId, 'resources'],
              refetchType: 'active'
            });
          }, 1500);
          
          return () => clearTimeout(timeoutId);
        }
      }
    }, [data, bookingId, queryClient]);
    
    // Process the data to ensure there are no missing resources
    const processedData = data?.map(bookingResource => {
      // If resource data is missing, create a placeholder with the ID
      if (!bookingResource.resource) {
        return {
          ...bookingResource,
          resource: {
            id: bookingResource.resourceId,
            name: `Resource ID: ${bookingResource.resourceId}`,
            description: 'Resource data unavailable',
            category: 'unknown',
            quantity: 0,
            isAvailable: false,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        };
      }
      return bookingResource;
    });
    
    return { data: processedData, ...rest };
  };

  // Create resource mutation
  const createResourceMutation = useMutation({
    mutationFn: async (data: Omit<Resource, 'id'>) => {
      const response = await apiRequest('POST', '/api/resources', data);
      return await response.json();
    },
    onSuccess: () => {
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
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update resource mutation
  const updateResourceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Resource> }) => {
      const response = await apiRequest('PATCH', `/api/resources/${id}`, data);
      return await response.json();
    },
    onSuccess: (_, variables) => {
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
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete resource mutation
  const deleteResourceMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/resources/${id}`);
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
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Add resource to booking mutation
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
      return await response.json();
    },
    onSuccess: (data, variables) => {
      // Update the query cache directly with the returned data
      const queryKey = ['/api/bookings', variables.bookingId, 'resources'];
      
      // Get current data from cache
      const currentData = queryClient.getQueryData<(BookingResource & { resource: Resource })[]>(queryKey) || [];
      
      // Add the new resource (which includes the resource data)
      const updatedData = [...currentData, data];
      
      // Update the cache directly
      queryClient.setQueryData(queryKey, updatedData);
      
      // Also invalidate to ensure we fetch fresh data on next query
      queryClient.invalidateQueries({ queryKey });
      
      toast({
        title: 'Resource added',
        description: 'The resource has been added to the booking successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to add resource',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update booking resource mutation
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
      return await response.json();
    },
    onSuccess: (data, variables) => {
      // Update the query cache directly with the returned data
      const queryKey = ['/api/bookings', variables.bookingId, 'resources'];
      
      // Get current data from cache
      const currentData = queryClient.getQueryData<(BookingResource & { resource: Resource })[]>(queryKey) || [];
      
      // Replace the updated resource
      const updatedData = currentData.map(item => 
        item.id === variables.id ? data : item
      );
      
      // Update the cache directly
      queryClient.setQueryData(queryKey, updatedData);
      
      // Also invalidate to ensure we fetch fresh data on next query
      queryClient.invalidateQueries({ queryKey });
      
      toast({
        title: 'Resource updated',
        description: 'The booking resource has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update resource',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Remove resource from booking mutation
  const removeBookingResourceMutation = useMutation({
    mutationFn: async ({ id, bookingId }: { id: number; bookingId: number }) => {
      await apiRequest('DELETE', `/api/bookings/${bookingId}/resources/${id}`);
      return id; // Return the ID for use in onSuccess
    },
    onSuccess: (deletedId, variables) => {
      const queryKey = ['/api/bookings', variables.bookingId, 'resources'];
      
      // Get current data from cache
      const currentData = queryClient.getQueryData<(BookingResource & { resource: Resource })[]>(queryKey) || [];
      
      // Filter out the deleted resource
      const updatedData = currentData.filter(item => item.id !== deletedId);
      
      // Update the cache directly
      queryClient.setQueryData(queryKey, updatedData);
      
      // Also invalidate to ensure we fetch fresh data on next query
      queryClient.invalidateQueries({ queryKey });
      
      toast({
        title: 'Resource removed',
        description: 'The resource has been removed from the booking successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to remove resource',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Remove all resources from booking mutation
  const removeAllBookingResourcesMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      await apiRequest('DELETE', `/api/bookings/${bookingId}/resources`);
      return bookingId;
    },
    onSuccess: (bookingId) => {
      const queryKey = ['/api/bookings', bookingId, 'resources'];
      
      // Set the cache to an empty array since all resources are removed
      queryClient.setQueryData(queryKey, []);
      
      // Also invalidate to ensure we fetch fresh data on next query
      queryClient.invalidateQueries({ queryKey });
      
      toast({
        title: 'Resources removed',
        description: 'All resources have been removed from the booking successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to remove resources',
        description: error.message,
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