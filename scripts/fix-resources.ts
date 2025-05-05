import { db } from '../server/db';
import { bookingResources } from '../shared/schema';
import { sql } from 'drizzle-orm';

/**
 * This script fixes corrupted booking resources data
 * by removing invalid entries and ensuring data integrity.
 */
async function fixResources() {
  console.log('Starting resource data cleanup...');

  try {
    // Step 1: Check the current state of booking_resources
    const currentResources = await db.select().from(bookingResources);
    console.log(`Found ${currentResources.length} booking resources in database`);

    // Step 2: Perform a data integrity check
    const validResources = currentResources.filter(
      (br) => br.id && br.bookingId && br.resourceId
    );
    
    console.log(`${validResources.length} resources have valid IDs`);
    console.log(`${currentResources.length - validResources.length} resources have invalid/missing data`);
    
    // Step 3: Delete all booking resources to start fresh
    // Note: This is a complete reset which is safer than trying to selectively fix
    console.log('Resetting booking_resources table...');
    
    await db.execute(sql`TRUNCATE TABLE booking_resources RESTART IDENTITY CASCADE`);
    
    console.log('All booking resources have been removed');
    
    // Optionally: Re-insert the valid entries if desired
    if (validResources.length > 0) {
      console.log('Re-inserting valid booking resources...');
      
      for (const resource of validResources) {
        await db.insert(bookingResources).values({
          bookingId: resource.bookingId,
          resourceId: resource.resourceId,
          quantity: resource.quantity,
          notes: resource.notes,
        });
      }
      
      console.log(`${validResources.length} valid resources have been restored`);
    }
    
    // Verify the cleanup was successful
    const remainingResources = await db.select().from(bookingResources);
    console.log(`Cleanup complete. Database now contains ${remainingResources.length} booking resources`);
    
    console.log('Resource data cleanup completed successfully');
  } catch (error) {
    console.error('Error during resource data cleanup:', error);
    process.exit(1);
  }
}

// Run the script directly
fixResources()
  .then(() => {
    console.log('Resource cleanup script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Resource cleanup script failed:', error);
    process.exit(1);
  });

export { fixResources };