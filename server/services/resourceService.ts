import { db } from '../db';
import { resources, bookingResources, Resource, InsertResource, BookingResource, InsertBookingResource } from '@shared/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

/**
 * ResourceService handles all operations related to resources
 * and booking resources, with robust error handling and data validation.
 */
export class ResourceService {
  /**
   * Validates that a resource exists before performing operations
   * @param resourceId The ID of the resource to validate
   * @returns True if the resource exists, false otherwise
   */
  private async validateResourceExists(resourceId: number): Promise<boolean> {
    try {
      const result = await db.select({ id: resources.id })
        .from(resources)
        .where(eq(resources.id, resourceId))
        .limit(1);
      
      return result.length > 0;
    } catch (error) {
      console.error('[ResourceService] Error validating resource existence:', error);
      return false;
    }
  }

  /**
   * Get all resources, ordered by name
   */
  async getAllResources(): Promise<Resource[]> {
    try {
      return await db.select().from(resources).orderBy(resources.name);
    } catch (error) {
      console.error('[ResourceService] Error getting all resources:', error);
      return [];
    }
  }
  
  /**
   * Get resources by category, ordered by name
   */
  async getResourcesByCategory(category: string): Promise<Resource[]> {
    try {
      return await db.select()
        .from(resources)
        .where(eq(resources.category, category))
        .orderBy(resources.name);
    } catch (error) {
      console.error(`[ResourceService] Error getting resources for category '${category}':`, error);
      return [];
    }
  }
  
  /**
   * Get a resource by its ID
   */
  async getResourceById(id: number): Promise<Resource | undefined> {
    try {
      const result = await db.select()
        .from(resources)
        .where(eq(resources.id, id));
      
      return result[0];
    } catch (error) {
      console.error(`[ResourceService] Error getting resource with ID ${id}:`, error);
      return undefined;
    }
  }
  
  /**
   * Create a new resource
   */
  async createResource(data: InsertResource): Promise<Resource> {
    try {
      const [newResource] = await db.insert(resources).values(data).returning();
      console.log(`[ResourceService] Created new resource: ${newResource.name}`);
      return newResource;
    } catch (error) {
      console.error('[ResourceService] Error creating resource:', error);
      throw new Error('Failed to create resource');
    }
  }
  
  /**
   * Update an existing resource
   */
  async updateResource(id: number, data: Partial<InsertResource>): Promise<Resource | undefined> {
    try {
      // First verify the resource exists
      const exists = await this.validateResourceExists(id);
      if (!exists) {
        console.error(`[ResourceService] Cannot update non-existent resource with ID ${id}`);
        return undefined;
      }
      
      const [updatedResource] = await db.update(resources)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(resources.id, id))
        .returning();
      
      console.log(`[ResourceService] Updated resource: ${updatedResource.name}`);
      return updatedResource;
    } catch (error) {
      console.error(`[ResourceService] Error updating resource with ID ${id}:`, error);
      return undefined;
    }
  }
  
  /**
   * Delete a resource
   */
  async deleteResource(id: number): Promise<boolean> {
    try {
      // First verify the resource exists
      const exists = await this.validateResourceExists(id);
      if (!exists) {
        console.error(`[ResourceService] Cannot delete non-existent resource with ID ${id}`);
        return false;
      }
      
      // Check if this resource is used by any bookings
      const bookingsUsingResource = await db.select({ count: sql`count(*)` })
        .from(bookingResources)
        .where(eq(bookingResources.resourceId, id));
      
      const count = Number(bookingsUsingResource[0]?.count || 0);
      if (count > 0) {
        console.warn(`[ResourceService] Resource with ID ${id} is used in ${count} bookings and cannot be deleted`);
        return false;
      }
      
      const result = await db.delete(resources)
        .where(eq(resources.id, id))
        .returning();
      
      const success = result.length > 0;
      console.log(`[ResourceService] Resource deletion ${success ? 'successful' : 'failed'} for ID ${id}`);
      return success;
    } catch (error) {
      console.error(`[ResourceService] Error deleting resource with ID ${id}:`, error);
      return false;
    }
  }
  
  /**
   * Get all unique resource categories
   */
  async getResourceCategories(): Promise<string[]> {
    try {
      const result = await db.selectDistinct({ category: resources.category }).from(resources);
      return result.map(r => r.category);
    } catch (error) {
      console.error('[ResourceService] Error getting resource categories:', error);
      return [];
    }
  }
  
  /**
   * Get all resources assigned to a booking
   */
  async getResourcesForBooking(bookingId: number): Promise<(BookingResource & { resource: Resource })[]> {
    console.log(`[ResourceService] Getting resources for booking: ${bookingId}`);
    
    try {
      const results = await db.select()
        .from(bookingResources)
        .innerJoin(resources, eq(bookingResources.resourceId, resources.id))
        .where(eq(bookingResources.bookingId, bookingId));
      
      console.log(`[ResourceService] Found ${results.length} resources for booking ${bookingId}`);
      
      // Transform the results into the expected format
      return results.map(row => ({
        id: row.booking_resources.id,
        bookingId: row.booking_resources.bookingId,
        resourceId: row.booking_resources.resourceId,
        quantity: row.booking_resources.quantity,
        notes: row.booking_resources.notes,
        resource: {
          id: row.resources.id,
          name: row.resources.name,
          description: row.resources.description,
          category: row.resources.category,
          quantity: row.resources.quantity,
          isAvailable: row.resources.isAvailable,
          createdAt: row.resources.createdAt,
          updatedAt: row.resources.updatedAt
        }
      }));
    } catch (error) {
      console.error(`[ResourceService] Error getting resources for booking ${bookingId}:`, error);
      return [];
    }
  }
  
  /**
   * Add a resource to a booking
   */
  async addResourceToBooking(data: InsertBookingResource): Promise<BookingResource> {
    try {
      // Ensure IDs are valid numbers
      const bookingId = typeof data.bookingId === 'string' ? parseInt(data.bookingId, 10) : data.bookingId;
      const resourceId = typeof data.resourceId === 'string' ? parseInt(data.resourceId, 10) : data.resourceId;
      
      // Check if the bookingId is valid
      if (isNaN(bookingId)) {
        throw new Error(`Invalid booking ID: ${data.bookingId}`);
      }
      
      // Check if the resourceId is valid
      if (isNaN(resourceId)) {
        throw new Error(`Invalid resource ID: ${data.resourceId}`);
      }
      
      // Use the verified IDs for further operations
      const verifiedData = {
        ...data,
        bookingId,
        resourceId
      };
      
      // Validate the resource exists
      const resourceExists = await this.validateResourceExists(resourceId);
      if (!resourceExists) {
        throw new Error(`Cannot add non-existent resource (ID: ${resourceId}) to booking`);
      }
      
      // Check if this resource is already assigned to this booking
      const existingAssignment = await db.select({ id: bookingResources.id })
        .from(bookingResources)
        .where(
          and(
            eq(bookingResources.bookingId, bookingId),
            eq(bookingResources.resourceId, resourceId)
          )
        )
        .limit(1);
      
      if (existingAssignment.length > 0) {
        throw new Error(`Resource (ID: ${resourceId}) is already assigned to this booking`);
      }
      
      // Ensure quantity is a valid number
      const quantity = typeof verifiedData.quantity === 'string' 
        ? parseInt(verifiedData.quantity, 10) 
        : verifiedData.quantity;
      
      if (isNaN(quantity) || quantity < 1) {
        throw new Error('Quantity must be a valid positive number');
      }
      
      // Insert with verified data
      const [newBookingResource] = await db.insert(bookingResources)
        .values({
          ...verifiedData,
          quantity
        })
        .returning();
      
      console.log(`[ResourceService] Added resource (ID: ${resourceId}) to booking (ID: ${bookingId})`);
      return newBookingResource;
    } catch (error) {
      console.error('[ResourceService] Error adding resource to booking:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to add resource to booking');
    }
  }
  
  /**
   * Update a booking resource
   */
  async updateBookingResource(id: number, data: Partial<InsertBookingResource>): Promise<BookingResource | undefined> {
    try {
      // Check if the booking resource exists
      const existingResource = await db.select()
        .from(bookingResources)
        .where(eq(bookingResources.id, id))
        .limit(1);
      
      if (existingResource.length === 0) {
        console.error(`[ResourceService] Cannot update non-existent booking resource with ID ${id}`);
        return undefined;
      }
      
      const [updatedBookingResource] = await db.update(bookingResources)
        .set(data)
        .where(eq(bookingResources.id, id))
        .returning();
      
      console.log(`[ResourceService] Updated booking resource ID ${id}`);
      return updatedBookingResource;
    } catch (error) {
      console.error(`[ResourceService] Error updating booking resource with ID ${id}:`, error);
      return undefined;
    }
  }
  
  /**
   * Remove a resource from a booking
   */
  async removeResourceFromBooking(id: number): Promise<boolean> {
    console.log(`[ResourceService] Attempting to remove booking resource with ID: ${id}`);
    
    try {
      // Check if the booking resource exists
      const existingResource = await db.select()
        .from(bookingResources)
        .where(eq(bookingResources.id, id))
        .limit(1);
      
      if (existingResource.length === 0) {
        console.error(`[ResourceService] No booking resource found with ID: ${id}`);
        return false;
      }
      
      const result = await db.delete(bookingResources)
        .where(eq(bookingResources.id, id))
        .returning();
      
      const success = result.length > 0;
      console.log(`[ResourceService] Removal ${success ? 'successful' : 'failed'} for booking resource ID: ${id}`);
      return success;
    } catch (error) {
      console.error(`[ResourceService] Error removing booking resource with ID ${id}:`, error);
      return false;
    }
  }
  
  /**
   * Remove all resources from a booking
   */
  async removeAllResourcesFromBooking(bookingId: number): Promise<boolean> {
    console.log(`[ResourceService] Attempting to remove all resources from booking ID: ${bookingId}`);
    
    try {
      // First count the resources to be deleted
      const resourcesCount = await db.select({ count: sql`count(*)` })
        .from(bookingResources)
        .where(eq(bookingResources.bookingId, bookingId));
      
      const count = Number(resourcesCount[0]?.count || 0);
      console.log(`[ResourceService] Found ${count} resources to delete for booking ID: ${bookingId}`);
      
      if (count === 0) {
        console.log(`[ResourceService] No resources found for booking ID: ${bookingId}, no deletion needed`);
        return true;
      }
      
      // Delete all resources in a transaction to ensure atomicity
      const result = await db.delete(bookingResources)
        .where(eq(bookingResources.bookingId, bookingId))
        .returning();
      
      const deletedCount = result.length;
      console.log(`[ResourceService] Deleted ${deletedCount} resources from booking ID: ${bookingId}`);
      
      // Verify all resources were deleted
      const remainingResources = await db.select({ count: sql`count(*)` })
        .from(bookingResources)
        .where(eq(bookingResources.bookingId, bookingId));
      
      const remainingCount = Number(remainingResources[0]?.count || 0);
      
      if (remainingCount > 0) {
        console.error(`[ResourceService] Failed to delete all resources. ${remainingCount} resources remain.`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`[ResourceService] Error removing all resources for booking ${bookingId}:`, error);
      return false;
    }
  }
}

// Create singleton instance
export const resourceService = new ResourceService();