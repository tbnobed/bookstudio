import { db, pool } from "../server/db";
import { eq, sql } from "drizzle-orm";
import { bookings } from "../shared/schema";

/**
 * Apply the booking copy feature to the database schema
 */
async function applyBookingCopy() {
  console.log("Applying booking copy functionality to the database...");

  try {
    // Check if we need to drop the existing function first
    const dropFuncIfExists = `
      DROP FUNCTION IF EXISTS copy_booking_to_multiple_dates(integer, date[]);
    `;
    
    await db.execute(sql.raw(dropFuncIfExists));
    console.log("Dropped any existing stored procedure to avoid conflicts");
    
    // Create an extremely simplified stored procedure that doesn't use record types
    const extremelySimpleFunc = `
      CREATE FUNCTION copy_booking_to_multiple_dates(
        booking_id INTEGER,
        dates DATE[]
      ) 
      RETURNS TABLE(id INTEGER) 
      AS $$
      DECLARE
        orig_title TEXT;
        orig_description TEXT;
        orig_type TEXT;
        orig_user_id INTEGER;
        orig_studio_id INTEGER;
        orig_pcr_room_id INTEGER;
        orig_severity TEXT;
        orig_template_id INTEGER;
        orig_notify_list JSONB;
        orig_start TIMESTAMP;
        orig_end TIMESTAMP;
        time_diff INTERVAL;
        new_start TIMESTAMP;
        new_end TIMESTAMP;
        new_id INTEGER;
        target_date DATE;
        studio_id_item INTEGER;
        studio_ids INTEGER[];
        has_conflict BOOLEAN;
      BEGIN
        -- Get original booking data as separate variables
        SELECT 
          title, description, type, user_id, studio_id, pcr_room_id, 
          severity, template_id, notify_list, start, "end"
        INTO 
          orig_title, orig_description, orig_type, orig_user_id, orig_studio_id, 
          orig_pcr_room_id, orig_severity, orig_template_id, orig_notify_list, 
          orig_start, orig_end
        FROM bookings 
        WHERE id = booking_id;
        
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Booking with ID % not found', booking_id;
          RETURN;
        END IF;
        
        -- Get associated studios
        SELECT array_agg(studio_id) INTO studio_ids
        FROM booking_studios
        WHERE booking_id = booking_id;
        
        -- Calculate time difference
        time_diff := orig_end - orig_start;
        
        -- Process each date
        FOREACH target_date IN ARRAY dates LOOP
          -- Skip if same date as original
          IF DATE(orig_start) = target_date THEN
            CONTINUE;
          END IF;
          
          -- Create new times
          new_start := target_date + (orig_start::time);
          new_end := new_start + time_diff;
          
          -- Check for conflicts
          has_conflict := FALSE;
          
          -- Only check for conflicts if we have studios to check against
          IF studio_ids IS NOT NULL AND array_length(studio_ids, 1) > 0 THEN
            -- Use EXISTS for efficiency
            IF EXISTS (
              SELECT 1 
              FROM bookings b 
              JOIN booking_studios bs ON b.id = bs.booking_id
              WHERE 
                bs.studio_id = ANY(studio_ids) AND
                ((new_start >= b.start AND new_start < b."end") OR
                 (new_end > b.start AND new_end <= b."end") OR
                 (new_start <= b.start AND new_end >= b."end"))
            ) THEN
              has_conflict := TRUE;
            END IF;
          ELSIF orig_studio_id IS NOT NULL THEN
            -- Check single studio
            IF EXISTS (
              SELECT 1 
              FROM bookings b 
              JOIN booking_studios bs ON b.id = bs.booking_id
              WHERE 
                bs.studio_id = orig_studio_id AND
                ((new_start >= b.start AND new_start < b."end") OR
                 (new_end > b.start AND new_end <= b."end") OR
                 (new_start <= b.start AND new_end >= b."end"))
            ) THEN
              has_conflict := TRUE;
            END IF;
          END IF;
          
          -- Skip if conflict
          IF has_conflict THEN
            CONTINUE;
          END IF;
          
          -- Insert new booking and get ID
          INSERT INTO bookings (
            title, description, type, start, "end", 
            user_id, studio_id, pcr_room_id, severity, 
            template_id, notify_list, created_at
          )
          VALUES (
            orig_title, 
            orig_description,
            orig_type, 
            new_start, 
            new_end, 
            orig_user_id,
            orig_studio_id, 
            orig_pcr_room_id, 
            orig_severity,
            orig_template_id, 
            orig_notify_list, 
            CURRENT_TIMESTAMP
          )
          RETURNING id INTO new_id;
          
          -- Link studios
          IF studio_ids IS NOT NULL AND array_length(studio_ids, 1) > 0 THEN
            FOREACH studio_id_item IN ARRAY studio_ids LOOP
              INSERT INTO booking_studios (booking_id, studio_id)
              VALUES (new_id, studio_id_item);
            END LOOP;
          ELSIF orig_studio_id IS NOT NULL THEN
            INSERT INTO booking_studios (booking_id, studio_id)
            VALUES (new_id, orig_studio_id);
          END IF;
          
          -- Return the new booking ID
          id := new_id;
          RETURN NEXT;
        END LOOP;
        
        RETURN;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    // Execute the extremely simplified function
    await db.execute(sql.raw(extremelySimpleFunc));
    
    console.log("Stored procedure created successfully");

    console.log("Booking copy feature applied successfully");
  } catch (error) {
    console.error("Error applying booking copy:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the function
applyBookingCopy()
  .then(() => {
    console.log("Completed application of booking copy functionality");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to apply booking copy functionality:", error);
    process.exit(1);
  });