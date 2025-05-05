import { useState, useEffect } from 'react';
import { useResources } from '@/hooks/use-resources';
import { Booking, Resource, BookingResource } from '@shared/schema';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, PlusCircle, Trash2, FileEdit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

// Form schema for adding resources to a booking
const bookingResourceSchema = z.object({
  resourceId: z.string().min(1, 'Please select a resource'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  notes: z.string().optional(),
});

// Form schema for editing a booking resource
const editBookingResourceSchema = z.object({
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  notes: z.string().optional(),
});

type BookingResourceFormValues = z.infer<typeof bookingResourceSchema>;
type EditBookingResourceFormValues = z.infer<typeof editBookingResourceSchema>;

interface BookingResourcesFormProps {
  booking: Booking;
}

export default function BookingResourcesForm({ booking }: BookingResourcesFormProps) {
  const { 
    getAllResources, 
    getResourceCategories, 
    getBookingResources, 
    addBookingResourceMutation, 
    updateBookingResourceMutation, 
    removeBookingResourceMutation, 
    removeAllBookingResourcesMutation 
  } = useResources();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [editingResource, setEditingResource] = useState<(BookingResource & { resource: Resource }) | null>(null);

  // Fetch all resources and categories
  const { data: allResources, isLoading: isResourcesLoading } = getAllResources();
  const { data: categories, isLoading: isCategoriesLoading } = getResourceCategories();
  
  // Fetch resources already assigned to the booking
  const { 
    data: bookingResources, 
    isLoading: isBookingResourcesLoading,
    refetch: refetchBookingResources
  } = getBookingResources(booking.id);

  // Add resource form
  const addForm = useForm<BookingResourceFormValues>({
    resolver: zodResolver(bookingResourceSchema),
    defaultValues: {
      resourceId: '',
      quantity: 1,
      notes: '',
    },
  });

  // Edit resource form
  const editForm = useForm<EditBookingResourceFormValues>({
    resolver: zodResolver(editBookingResourceSchema),
    defaultValues: {
      quantity: 1,
      notes: '',
    },
  });

  // Filter resources by category and exclude ones already assigned to the booking
  const getFilteredResources = () => {
    if (!allResources || !bookingResources) return [];
    
    // Get IDs of resources already assigned to this booking
    const assignedResourceIds = bookingResources.map(br => br.resourceId);
    
    // Filter resources by category and exclude already assigned ones
    return allResources.filter(resource => {
      if (!resource) return false;
      const matchesCategory = activeCategory === 'all' || (resource.category && resource.category === activeCategory);
      const isNotAssigned = !assignedResourceIds.includes(resource.id);
      return matchesCategory && isNotAssigned;
    });
  };

  // Handle adding a resource to the booking
  const onAddSubmit = async (values: BookingResourceFormValues) => {
    try {
      await addBookingResourceMutation.mutateAsync({
        bookingId: booking.id,
        resourceId: parseInt(values.resourceId),
        quantity: values.quantity,
        notes: values.notes,
      });
      
      // Manually refetch the booking resources to ensure we have the latest data
      await refetchBookingResources();
      
      setIsAddDialogOpen(false);
      addForm.reset();
    } catch (error) {
      console.error('Failed to add resource to booking:', error);
    }
  };

  // Handle editing a booking resource
  const onEditSubmit = async (values: EditBookingResourceFormValues) => {
    if (!editingResource) return;
    
    try {
      await updateBookingResourceMutation.mutateAsync({
        id: editingResource.id,
        data: {
          quantity: values.quantity,
          notes: values.notes,
        },
        bookingId: booking.id,
      });
      
      // Manually refetch the booking resources to ensure we have the latest data
      await refetchBookingResources();
      
      setIsEditDialogOpen(false);
      setEditingResource(null);
    } catch (error) {
      console.error('Failed to update booking resource:', error);
    }
  };

  // Handle removing a resource from the booking
  const handleRemoveResource = async (id: number) => {
    try {
      console.log(`Attempting to remove booking resource ID: ${id} from booking ID: ${booking.id}`);
      await removeBookingResourceMutation.mutateAsync({
        id,
        bookingId: booking.id,
      });
      
      // Manually refetch the booking resources to ensure we have the latest data
      console.log('Resource removed, now refetching booking resources');
      await refetchBookingResources();
    } catch (error) {
      console.error('Failed to remove resource from booking:', error);
      // The error will be handled by the mutation's onError callback,
      // which will display a toast notification
    }
  };

  // Handle removing all resources from the booking
  const handleRemoveAllResources = async () => {
    try {
      console.log(`Attempting to remove all resources from booking ID: ${booking.id}`);
      await removeAllBookingResourcesMutation.mutateAsync(booking.id);
      
      // Manually refetch the booking resources to ensure we have the latest data
      console.log('All resources removed, now refetching booking resources');
      await refetchBookingResources();
    } catch (error) {
      console.error('Failed to remove all resources from booking:', error);
      // The error will be handled by the mutation's onError callback,
      // which will display a toast notification
    }
  };

  // Open edit dialog with booking resource data
  const openEditDialog = (bookingResource: BookingResource & { resource: Resource }) => {
    setEditingResource(bookingResource);
    editForm.setValue('quantity', bookingResource.quantity);
    editForm.setValue('notes', bookingResource.notes || '');
    setIsEditDialogOpen(true);
  };

  // Show loading indicator while fetching data
  if (isResourcesLoading || isCategoriesLoading || isBookingResourcesLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Get filtered resources based on selected category
  const filteredResources = getFilteredResources();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-medium">Booking Resources</h3>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddDialogOpen(true)}
            disabled={!allResources || allResources.length === 0}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Resource
          </Button>
          {bookingResources && bookingResources.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove All Resources</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to remove all resources from this booking? This action cannot be undone.
                    {bookingResources.some(br => !br.resource || !br.resource.name) && (
                      <p className="mt-2 text-amber-500">
                        Some resources appear to be invalid or corrupted. Using "Remove All" is recommended to clean up all resources.
                      </p>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRemoveAllResources}
                    className="bg-destructive text-destructive-foreground"
                  >
                    Remove All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {bookingResources && bookingResources.length > 0 ? (
        <div className="rounded-md border">
          <div className="grid grid-cols-[auto,1fr,auto,auto] gap-4 p-4 font-medium border-b">
            <div>Category</div>
            <div>Resource</div>
            <div>Quantity</div>
            <div>Actions</div>
          </div>
          <ScrollArea className="max-h-[300px]">
            {bookingResources.map((bookingResource) => (
              <div key={bookingResource.id} className="grid grid-cols-[auto,1fr,auto,auto] gap-4 p-4 border-b last:border-b-0 items-center">
                <Badge variant="outline" className="capitalize">
                  {bookingResource.resource && bookingResource.resource.category ? bookingResource.resource.category : "Unknown"}
                </Badge>
                <div>
                  <div className="font-medium">
                    {bookingResource.resource && bookingResource.resource.name 
                      ? bookingResource.resource.name 
                      : bookingResource.resourceId 
                        ? `Resource ID: ${bookingResource.resourceId}` 
                        : "Invalid Resource"}
                  </div>
                  {bookingResource.notes && (
                    <div className="text-sm text-muted-foreground mt-1">{bookingResource.notes}</div>
                  )}
                  {(!bookingResource.resource || !bookingResource.resource.name) && (
                    <div className="text-sm text-amber-500 font-medium mt-1">
                      Resource data missing or corrupt. Please remove and re-add this resource.
                    </div>
                  )}
                </div>
                <div className="px-3 py-1 bg-secondary rounded-md text-center">
                  {bookingResource.quantity || 0}
                </div>
                <div className="flex items-center space-x-2">
                  {bookingResource.resource && bookingResource.resource.name && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(bookingResource)}
                    >
                      <FileEdit className="h-4 w-4" />
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Resource</AlertDialogTitle>
                        <AlertDialogDescription>
                          {bookingResource.resource && bookingResource.resource.name 
                            ? `Are you sure you want to remove "${bookingResource.resource.name}" from this booking?`
                            : "Are you sure you want to remove this resource from the booking?"}
                          {(!bookingResource.resource || !bookingResource.resource.name) && (
                            <p className="mt-2 text-amber-500">
                              This resource appears to be invalid or corrupted. Removing it is recommended.
                            </p>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRemoveResource(bookingResource.id)}
                          className="bg-destructive text-destructive-foreground"
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-muted-foreground mb-4">No resources have been added to this booking yet.</p>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(true)}
              disabled={!allResources || allResources.length === 0}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Resource
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add Resource Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Resource to Booking</DialogTitle>
            <DialogDescription>
              Select resources to assign to this booking.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="all" value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              {categories?.map((category) => (
                <TabsTrigger key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={activeCategory} className="mt-0">
              {filteredResources.length > 0 ? (
                <Form {...addForm}>
                  <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                    <FormField
                      control={addForm.control}
                      name="resourceId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Resource</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a resource" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {filteredResources.map((resource) => (
                                <SelectItem key={resource.id} value={resource.id.toString()}>
                                  {resource.name} ({resource.quantity} available)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addForm.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Specify how many units of this resource are needed
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Add any specific requirements or notes about this resource"
                              className="resize-none"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsAddDialogOpen(false);
                          addForm.reset();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={addBookingResourceMutation.isPending}>
                        {addBookingResourceMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Add Resource
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground mb-4">
                    {activeCategory === 'all'
                      ? 'No available resources found.'
                      : `No available resources in the ${activeCategory} category.`}
                  </p>
                  {activeCategory !== 'all' && (
                    <Button variant="outline" onClick={() => setActiveCategory('all')}>
                      View All Categories
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Edit Resource Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) setEditingResource(null);
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Booking Resource</DialogTitle>
            <DialogDescription>
              {editingResource && editingResource.resource && editingResource.resource.name ? 
                `Update details for ${editingResource.resource.name}` : 
                'Update resource details'}
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Add any specific requirements or notes about this resource"
                        className="resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingResource(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateBookingResourceMutation.isPending}>
                  {updateBookingResourceMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}