import { db } from '../db';
import { resources, bookingResources, Resource, InsertResource, BookingResource, InsertBookingResource } from '@shared/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

export class ResourceService {
  // Get all resources
  async getAllResources(): Promise<Resource[]> {
    return db.select().from(resources).orderBy(resources.name);
  }
  
  // Get resources by category
  async getResourcesByCategory(category: string): Promise<Resource[]> {
    return db.select().from(resources).where(eq(resources.category, category)).orderBy(resources.name);
  }
  
  // Get resource by ID
  async getResourceById(id: number): Promise<Resource | undefined> {
    const result = await db.select().from(resources).where(eq(resources.id, id));
    return result[0];
  }
  
  // Create new resource
  async createResource(data: InsertResource): Promise<Resource> {
    const [newResource] = await db.insert(resources).values(data).returning();
    return newResource;
  }
  
  // Update resource
  async updateResource(id: number, data: Partial<InsertResource>): Promise<Resource | undefined> {
    const [updatedResource] = await db.update(resources)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(resources.id, id))
      .returning();
    
    return updatedResource;
  }
  
  // Delete resource
  async deleteResource(id: number): Promise<boolean> {
    const result = await db.delete(resources).where(eq(resources.id, id)).returning();
    return result.length > 0;
  }
  
  // Get all unique resource categories
  async getResourceCategories(): Promise<string[]> {
    const result = await db.selectDistinct({ category: resources.category }).from(resources);
    return result.map(r => r.category);
  }
  
  // Get resources for a booking
  async getResourcesForBooking(bookingId: number): Promise<(BookingResource & { resource: Resource })[]> {
    console.log(`[ResourceService] Getting resources for booking: ${bookingId}`);
    
    try {
      const results = await db.select()
        .from(bookingResources)
        .innerJoin(resources, eq(bookingResources.resourceId, resources.id))
        .where(eq(bookingResources.bookingId, bookingId));
      
      console.log(`[ResourceService] Found ${results.length} resources for booking ${bookingId}`);
      
      // Transform the results with explicit field names to avoid missing data
      const transformedResults = results.map(row => {
        const bookingResource = {
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
        };
        
        console.log(`[ResourceService] Resource mapping: ${JSON.stringify({
          brId: bookingResource.id,
          resourceId: bookingResource.resourceId,
          resourceName: bookingResource.resource.name,
          resourceCategory: bookingResource.resource.category
        })}`);
        
        return bookingResource;
      });
      
      return transformedResults;
    } catch (error) {
      console.error(`[ResourceService] Error getting resources for booking ${bookingId}:`, error);
      return []; // Return empty array on error
    }
  }
  
  // Add resource to booking
  async addResourceToBooking(data: InsertBookingResource): Promise<BookingResource> {
    const [newBookingResource] = await db.insert(bookingResources).values(data).returning();
    return newBookingResource;
  }
  
  // Update booking resource
  async updateBookingResource(id: number, data: Partial<InsertBookingResource>): Promise<BookingResource | undefined> {
    const [updatedBookingResource] = await db.update(bookingResources)
      .set(data)
      .where(eq(bookingResources.id, id))
      .returning();
    
    return updatedBookingResource;
  }
  
  // Remove resource from booking
  async removeResourceFromBooking(id: number): Promise<boolean> {
    console.log(`[ResourceService] Attempting to remove booking resource with ID: ${id}`);
    
    try {
      // First check if the resource exists
      const existingResource = await db.select()
        .from(bookingResources)
        .where(eq(bookingResources.id, id))
        .limit(1);
      
      if (existingResource.length === 0) {
        console.log(`[ResourceService] No booking resource found with ID: ${id}`);
        
        // Try a direct SQL query to check if the resource exists, bypassing ORM layer
        try {
          const checkResult = await db.execute(
            sql`SELECT COUNT(*) AS count FROM booking_resources WHERE id = ${id}`
          );
          
          const rawCount = checkResult?.rows?.[0]?.count;
          console.log(`[ResourceService] Raw SQL check for ID ${id} result:`, rawCount);
          
          if (rawCount && Number(rawCount) > 0) {
            // Resource exists but ORM couldn't find it, try direct deletion
            console.log(`[ResourceService] Found booking resource with ID: ${id} using raw SQL, attempting direct deletion`);
            
            const deleteResult = await db.execute(
              sql`DELETE FROM booking_resources WHERE id = ${id}`
            );
            
            console.log(`[ResourceService] Raw SQL deletion result:`, deleteResult);
            return true;
          }
        } catch (sqlError) {
          console.error(`[ResourceService] Error in raw SQL check/delete for resource ${id}:`, sqlError);
        }
        
        return false;
      }
      
      console.log(`[ResourceService] Found booking resource with ID: ${id}, proceeding with deletion`);
      
      // Delete the resource
      const result = await db.delete(bookingResources)
        .where(eq(bookingResources.id, id))
        .returning();
      
      const success = result.length > 0;
      console.log(`[ResourceService] Deletion ${success ? 'successful' : 'failed'} for booking resource ID: ${id}`);
      
      // Double check deletion even if ORM says it succeeded
      if (success) {
        const checkAfterDeletion = await db.select()
          .from(bookingResources)
          .where(eq(bookingResources.id, id))
          .limit(1);
        
        if (checkAfterDeletion.length > 0) {
          console.log(`[ResourceService] WARNING: Resource ${id} still exists after deletion was reported as successful`);
          
          // Try direct SQL deletion as a final attempt
          try {
            await db.execute(
              sql`DELETE FROM booking_resources WHERE id = ${id}`
            );
            console.log(`[ResourceService] Attempted final direct SQL deletion for resource ${id}`);
          } catch (finalError) {
            console.error(`[ResourceService] Error in final direct SQL deletion for resource ${id}:`, finalError);
          }
        }
      }
      
      return success;
    } catch (error) {
      console.error(`[ResourceService] Error removing booking resource ${id}:`, error);
      
      // Try one last approach directly with SQL
      try {
        console.log(`[ResourceService] Attempting direct SQL deletion as fallback for resource ${id}`);
        await db.execute(
          sql`DELETE FROM booking_resources WHERE id = ${id}`
        );
        console.log(`[ResourceService] Direct SQL deletion fallback attempted for resource ${id}`);
        return true;
      } catch (fallbackError) {
        console.error(`[ResourceService] Error in fallback direct SQL deletion for resource ${id}:`, fallbackError);
        return false;
      }
    }
  }
  
  // Remove all resources from a booking
  async removeAllResourcesFromBooking(bookingId: number): Promise<boolean> {
    console.log(`[ResourceService] Attempting to remove all resources from booking ID: ${bookingId}`);
    
    try {
      // First check if there are any resources to delete
      const resources = await db.select({ count: sql`count(*)` })
        .from(bookingResources)
        .where(eq(bookingResources.bookingId, bookingId));
      
      const count = Number(resources[0]?.count || 0);
      console.log(`[ResourceService] Found ${count} resources to delete for booking ID: ${bookingId}`);
      
      if (count === 0) {
        // No resources found, consider this a successful operation
        console.log(`[ResourceService] No resources found for booking ID: ${bookingId}, no deletion needed`);
        return true;
      }
      
      // Get the IDs of resources we're about to delete (for logging purposes)
      const resourcesBeingRemoved = await db.select({ id: bookingResources.id, resourceId: bookingResources.resourceId })
        .from(bookingResources)
        .where(eq(bookingResources.bookingId, bookingId));
      
      console.log(`[ResourceService] Removing the following booking resources for booking ID ${bookingId}:`, 
        resourcesBeingRemoved.map(r => `BR ID: ${r.id}, Resource ID: ${r.resourceId}`).join(', '));
      
      // Delete the resources - use a try/catch here to ensure we delete as much as possible
      try {
        // Try to delete using a direct SQL query instead of the ORM to bypass any potential ORM issues
        const deleteResult = await db.execute(
          sql`DELETE FROM booking_resources WHERE booking_id = ${bookingId}`
        );
        
        console.log(`[ResourceService] Raw SQL deletion result:`, deleteResult);
        
        // Double-check the deletion was successful
        const remainingResources = await db.select({ count: sql`count(*)` })
          .from(bookingResources)
          .where(eq(bookingResources.bookingId, bookingId));
        
        const remainingCount = Number(remainingResources[0]?.count || 0);
        const success = remainingCount === 0;
        
        console.log(`[ResourceService] Delete all operation ${success ? 'successful' : 'failed'} for booking ID: ${bookingId}. ${count - remainingCount} resources removed, ${remainingCount} remaining.`);
        
        return success;
      } catch (deleteError) {
        console.error(`[ResourceService] Error during SQL delete operation:`, deleteError);
        
        // Fallback approach: try to delete resources one by one
        console.log(`[ResourceService] Attempting fallback: deleting resources one by one`);
        let deletedCount = 0;
        
        for (const resource of resourcesBeingRemoved) {
          try {
            await db.delete(bookingResources)
              .where(eq(bookingResources.id, resource.id));
            
            deletedCount++;
            console.log(`[ResourceService] Successfully deleted booking resource ID ${resource.id}`);
          } catch (individualError) {
            console.error(`[ResourceService] Failed to delete booking resource ID ${resource.id}:`, individualError);
          }
        }
        
        console.log(`[ResourceService] Fallback deletion complete. Deleted ${deletedCount}/${resourcesBeingRemoved.length} resources`);
        return deletedCount > 0;
      }
    } catch (error) {
      console.error(`[ResourceService] Error removing all resources for booking ${bookingId}:`, error);
      return false;
    }
  }
}

// Create singleton instance
export const resourceService = new ResourceService();