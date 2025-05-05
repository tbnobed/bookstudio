import { useQuery, useMutation } from '@tanstack/react-query';
import { Resource, InsertResource, BookingResource } from '@shared/schema';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Hook for managing resources
export function useResources() {
  const { toast } = useToast();
  
  // Get all resources or resources by category
  const getAllResources = (category?: string) => {
    const queryString = category ? `?category=${encodeURIComponent(category)}` : '';
    return useQuery<Resource[], Error>({
      queryKey: ['/api/resources', category].filter(Boolean), // Remove undefined values
      queryFn: async () => {
        const response = await fetch(`/api/resources${queryString}`);
        if (!response.ok) {
          throw new Error('Failed to fetch resources');
        }
        return response.json();
      }
    });
  };
  
  // Get resource categories
  const getResourceCategories = () => {
    return useQuery<string[], Error>({
      queryKey: ['/api/resource-categories'],
      queryFn: async () => {
        const response = await fetch('/api/resource-categories');
        if (!response.ok) {
          throw new Error('Failed to fetch resource categories');
        }
        return response.json();
      }
    });
  };
  
  // Get a specific resource by ID
  const getResourceById = (id: number) => {
    return useQuery<Resource, Error>({
      queryKey: ['/api/resources', id],
      queryFn: async () => {
        const response = await fetch(`/api/resources/${id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch resource');
        }
        return response.json();
      },
      enabled: !!id // Only run if ID is provided
    });
  };
  
  // Create a new resource
  const createResourceMutation = useMutation<Resource, Error, InsertResource>({
    mutationFn: async (data) => {
      const response = await apiRequest('POST', '/api/resources', data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create resource');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/resource-categories'] });
      toast({
        title: 'Resource created',
        description: 'The resource has been created successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to create resource',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Update a resource
  const updateResourceMutation = useMutation<Resource, Error, { id: number, data: Partial<InsertResource> }>({
    mutationFn: async ({ id, data }) => {
      const response = await apiRequest('PATCH', `/api/resources/${id}`, data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update resource');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/resources', variables.id] });
      toast({
        title: 'Resource updated',
        description: 'The resource has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to update resource',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Delete a resource
  const deleteResourceMutation = useMutation<void, Error, number>({
    mutationFn: async (id) => {
      const response = await apiRequest('DELETE', `/api/resources/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete resource');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/resource-categories'] });
      toast({
        title: 'Resource deleted',
        description: 'The resource has been deleted successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to delete resource',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Get resources for a booking
  const getBookingResources = (bookingId: number) => {
    return useQuery<(BookingResource & { resource: Resource })[], Error>({
      queryKey: ['/api/bookings', bookingId, 'resources'],
      queryFn: async () => {
        const response = await fetch(`/api/bookings/${bookingId}/resources`);
        if (!response.ok) {
          throw new Error('Failed to fetch booking resources');
        }
        return response.json();
      },
      enabled: !!bookingId
    });
  };
  
  // Add a resource to a booking
  const addBookingResourceMutation = useMutation<
    BookingResource, 
    Error, 
    { bookingId: number, resourceId: number, quantity: number, notes?: string }
  >({
    mutationFn: async (data) => {
      const { bookingId, ...rest } = data;
      const response = await apiRequest('POST', `/api/bookings/${bookingId}/resources`, rest);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add resource to booking');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings', variables.bookingId, 'resources'] });
      toast({
        title: 'Resource added',
        description: 'The resource has been added to the booking successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to add resource',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Update a booking resource
  const updateBookingResourceMutation = useMutation<
    BookingResource, 
    Error, 
    { id: number, data: Partial<{ quantity: number, notes?: string }>, bookingId: number }
  >({
    mutationFn: async ({ id, data }) => {
      const response = await apiRequest('PATCH', `/api/booking-resources/${id}`, data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update booking resource');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings', variables.bookingId, 'resources'] });
      toast({
        title: 'Resource updated',
        description: 'The booking resource has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to update resource',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Remove a resource from a booking
  const removeBookingResourceMutation = useMutation<void, Error, { id: number, bookingId: number }>({
    mutationFn: async ({ id }) => {
      const response = await apiRequest('DELETE', `/api/booking-resources/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to remove resource from booking');
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings', variables.bookingId, 'resources'] });
      toast({
        title: 'Resource removed',
        description: 'The resource has been removed from the booking successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to remove resource',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Remove all resources from a booking
  const removeAllBookingResourcesMutation = useMutation<void, Error, number>({
    mutationFn: async (bookingId) => {
      const response = await apiRequest('DELETE', `/api/bookings/${bookingId}/resources`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to remove all resources from booking');
      }
    },
    onSuccess: (_, bookingId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings', bookingId, 'resources'] });
      toast({
        title: 'Resources removed',
        description: 'All resources have been removed from the booking successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to remove resources',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  return {
    getAllResources,
    getResourceCategories,
    getResourceById,
    createResourceMutation,
    updateResourceMutation,
    deleteResourceMutation,
    getBookingResources,
    addBookingResourceMutation,
    updateBookingResourceMutation,
    removeBookingResourceMutation,
    removeAllBookingResourcesMutation
  };
}