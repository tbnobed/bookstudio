import { db } from '../db';
import { resources, bookingResources, Resource, InsertResource, BookingResource, InsertBookingResource } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

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
    return db.select({
      id: bookingResources.id,
      bookingId: bookingResources.bookingId,
      resourceId: bookingResources.resourceId,
      quantity: bookingResources.quantity,
      notes: bookingResources.notes,
      resource: resources
    })
    .from(bookingResources)
    .innerJoin(resources, eq(bookingResources.resourceId, resources.id))
    .where(eq(bookingResources.bookingId, bookingId));
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
    const result = await db.delete(bookingResources).where(eq(bookingResources.id, id)).returning();
    return result.length > 0;
  }
  
  // Remove all resources from a booking
  async removeAllResourcesFromBooking(bookingId: number): Promise<boolean> {
    const result = await db.delete(bookingResources)
      .where(eq(bookingResources.bookingId, bookingId))
      .returning();
    
    return result.length > 0;
  }
}

// Create singleton instance
export const resourceService = new ResourceService();