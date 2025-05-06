import { db, pool } from "../server/db";
import { eq, sql } from "drizzle-orm";
import { bookings } from "../shared/schema";

/**
 * Apply the booking copy feature to the database schema
 */
async function applyBookingCopy() {
  console.log("Applying booking copy functionality to the database...");

  try {
    // Check if the `copyBookingToMultipleDates` function exists in the database
    const funcExists = await db.execute<{ exists: number }>(sql`
      SELECT 1 as exists FROM pg_proc 
      WHERE proname = 'copy_booking_to_multiple_dates'
    `);

    if (!funcExists.rows || funcExists.rows.length === 0) {
      console.log("Creating copy_booking_to_multiple_dates stored procedure...");
      
      // Create the stored procedure
      await db.execute(sql`
        CREATE OR REPLACE FUNCTION copy_booking_to_multiple_dates(
          p_booking_id INTEGER,
          p_dates DATE[]
        )
        RETURNS SETOF bookings
        LANGUAGE plpgsql
        AS $$
        DECLARE
          v_original bookings;
          v_new_booking bookings;
          v_date DATE;
          v_start TIMESTAMP;
          v_end TIMESTAMP;
          v_time_diff INTERVAL;
          v_studio_id INTEGER;
          v_studio_ids INTEGER[];
        BEGIN
          -- Get the original booking
          SELECT * INTO v_original FROM bookings WHERE id = p_booking_id;
          
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Booking with ID % not found', p_booking_id;
          END IF;
          
          -- Get associated studios from booking_studios table
          SELECT array_agg(studio_id) INTO v_studio_ids
          FROM booking_studios
          WHERE booking_id = p_booking_id;
          
          -- Calculate time difference between start and end
          v_time_diff := v_original.end - v_original.start;
          
          -- Process each target date
          FOREACH v_date IN ARRAY p_dates
          LOOP
            -- Skip if the target date is the same as the original booking date
            IF DATE(v_original.start) = v_date THEN
              CONTINUE;
            END IF;
            
            -- Create the new start and end times on the target date
            v_start := v_date + TIME(v_original.start);
            v_end := v_start + v_time_diff;
            
            -- Check for conflicts with each studio
            IF v_studio_ids IS NOT NULL AND array_length(v_studio_ids, 1) > 0 THEN
              -- Handle multiple studio bookings
              DECLARE
                v_has_conflict BOOLEAN := FALSE;
                v_studio INTEGER;
              BEGIN
                FOREACH v_studio IN ARRAY v_studio_ids
                LOOP
                  IF EXISTS (
                    SELECT 1 FROM bookings b
                    JOIN booking_studios bs ON b.id = bs.booking_id
                    WHERE bs.studio_id = v_studio
                    AND (
                      (v_start >= b.start AND v_start < b.end) OR
                      (v_end > b.start AND v_end <= b.end) OR
                      (v_start <= b.start AND v_end >= b.end)
                    )
                  ) THEN
                    v_has_conflict := TRUE;
                    EXIT;  -- Exit the loop on first conflict
                  END IF;
                END LOOP;
                
                -- Skip this date if there's a conflict
                IF v_has_conflict THEN
                  CONTINUE;
                END IF;
              END;
            ELSIF v_original.studio_id IS NOT NULL THEN
              -- Handle single studio booking
              IF EXISTS (
                SELECT 1 FROM bookings b
                JOIN booking_studios bs ON b.id = bs.booking_id
                WHERE bs.studio_id = v_original.studio_id
                AND (
                  (v_start >= b.start AND v_start < b.end) OR
                  (v_end > b.start AND v_end <= b.end) OR
                  (v_start <= b.start AND v_end >= b.end)
                )
              ) THEN
                CONTINUE;  -- Skip on conflict
              END IF;
            END IF;
            
            -- Insert new booking
            INSERT INTO bookings (
              title, description, type, start, end, 
              user_id, studio_id, pcr_room_id, severity, 
              template_id, notify_list, created_at
            )
            VALUES (
              v_original.title, 
              v_original.description, 
              v_original.type,
              v_start, 
              v_end, 
              v_original.user_id,
              v_original.studio_id, 
              v_original.pcr_room_id, 
              v_original.severity,
              v_original.template_id, 
              v_original.notify_list, 
              CURRENT_TIMESTAMP
            )
            RETURNING * INTO v_new_booking;
            
            -- Link studios for the new booking
            IF v_studio_ids IS NOT NULL AND array_length(v_studio_ids, 1) > 0 THEN
              FOREACH v_studio_id IN ARRAY v_studio_ids
              LOOP
                INSERT INTO booking_studios (booking_id, studio_id)
                VALUES (v_new_booking.id, v_studio_id);
              END LOOP;
            ELSIF v_original.studio_id IS NOT NULL THEN
              INSERT INTO booking_studios (booking_id, studio_id)
              VALUES (v_new_booking.id, v_original.studio_id);
            END IF;
            
            RETURN NEXT v_new_booking;
          END LOOP;
          
          RETURN;
        END;
        $$;
      `);
      
      console.log("Stored procedure created successfully");
    } else {
      console.log("Booking copy stored procedure already exists, skipping creation");
    }

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